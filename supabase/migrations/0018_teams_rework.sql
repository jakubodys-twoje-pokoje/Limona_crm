-- =============================================================
-- 0018 — zespoły jako pierwszoklasowa jednostka (zamiast sztywnych
-- par manager_id/member_id w team_visibility):
--   * teams — nazwa, opis, kto i kiedy utworzył
--   * team_members — roster z rolą lead/member, wielu liderów możliwych
-- Grupy komunikacji ("Zespół X") i widoczność raportów managera nadal
-- opierają się o tę samą tabelę — group_messages.group_id trzyma teraz
-- teams.id (bez zmiany kolumny, była plain uuid bez FK).
-- Backfill zachowuje ciągłość: nowy zespół dla istniejącego managera
-- dostaje id = manager_id, więc historia group_messages się nie gubi.
-- =============================================================

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null on update cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade on update cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  is_lead    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id);

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Polityki RLS na daily_reports / missed_report_acks (z migracji 0017)
-- odwoływały się do team_visibility ("czy user jest managerem targetu")
-- — trzeba je przepisać na team_members, ZANIM usuniemy tę tabelę,
-- inaczej DROP TABLE niżej wywali błąd o zależnych obiektach.
-- ---------------------------------------------------------------
drop policy if exists "daily_reports_select" on public.daily_reports;
create policy "daily_reports_select" on public.daily_reports
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_manage_teams()
    or exists (
      select 1 from public.team_members tm_lead
      join public.team_members tm_target on tm_target.team_id = tm_lead.team_id
      where tm_lead.user_id = (select auth.uid()) and tm_lead.is_lead
        and tm_target.user_id = daily_reports.user_id
    )
  );

drop policy if exists "missed_report_acks_select" on public.missed_report_acks;
create policy "missed_report_acks_select" on public.missed_report_acks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_manage_teams()
    or exists (
      select 1 from public.team_members tm_lead
      join public.team_members tm_target on tm_target.team_id = tm_lead.team_id
      where tm_lead.user_id = (select auth.uid()) and tm_lead.is_lead
        and tm_target.user_id = missed_report_acks.user_id
    )
  );

-- ---------------------------------------------------------------
-- Backfill z team_visibility (jeśli tabela jeszcze istnieje)
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'team_visibility') then
    insert into public.teams (id, name, created_by)
    select distinct tv.manager_id, 'Zespół ' || coalesce(p.full_name, 'bez nazwy'), tv.manager_id
    from public.team_visibility tv
    join public.profiles p on p.id = tv.manager_id
    on conflict (id) do nothing;

    insert into public.team_members (team_id, user_id, is_lead)
    select distinct tv.manager_id, tv.manager_id, true
    from public.team_visibility tv
    on conflict (team_id, user_id) do update set is_lead = true;

    insert into public.team_members (team_id, user_id, is_lead)
    select tv.manager_id, tv.member_id, false
    from public.team_visibility tv
    on conflict (team_id, user_id) do nothing;

    drop table public.team_visibility;
  end if;
end $$;

-- ---------------------------------------------------------------
-- RLS — odczyt dla każdego zalogowanego, zapis tylko admin/kierownik_centrali
-- ---------------------------------------------------------------
alter table public.teams enable row level security;

drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams
  for select to authenticated using (true);

drop policy if exists "teams_insert" on public.teams;
create policy "teams_insert" on public.teams
  for insert to authenticated
  with check (public.can_manage_teams() and created_by = (select auth.uid()));

drop policy if exists "teams_update" on public.teams;
create policy "teams_update" on public.teams
  for update to authenticated
  using (public.can_manage_teams())
  with check (public.can_manage_teams());

drop policy if exists "teams_delete" on public.teams;
create policy "teams_delete" on public.teams
  for delete to authenticated using (public.can_manage_teams());

alter table public.team_members enable row level security;

drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members
  for select to authenticated using (true);

drop policy if exists "team_members_insert" on public.team_members;
create policy "team_members_insert" on public.team_members
  for insert to authenticated with check (public.can_manage_teams());

drop policy if exists "team_members_update" on public.team_members;
create policy "team_members_update" on public.team_members
  for update to authenticated
  using (public.can_manage_teams())
  with check (public.can_manage_teams());

drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete" on public.team_members
  for delete to authenticated using (public.can_manage_teams());
