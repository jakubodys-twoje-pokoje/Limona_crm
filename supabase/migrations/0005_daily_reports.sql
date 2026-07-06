-- =============================================================
-- 0005_daily_reports — fundament danych + raport dzienny
--
-- Część A (etap 0): outcome'y zadań i temperatura leadów
--  * tasks: task_type / contact_category / outcome /
--    rejection_reason / rejection_note (uniony po stronie aplikacji,
--    konwencja: enumy jako text)
--  * properties: lead_temperature, status_changed_at (+ trigger
--    ustawiający przy zmianie statusu, + backfill z activity_log)
--
-- Część B (etap 1): raport dzienny
--  * daily_reports: spostrzeżenia agenta + znacznik przesłania
--  * missed_report_acks: potwierdzenia braku raportu (zliczane
--    do ewaluacji per miesiąc)
-- =============================================================

-- ---------------------------------------------------------------
-- A. tasks — dane strukturalne z pracy kontaktowej
-- ---------------------------------------------------------------
alter table public.tasks
  add column task_type        text,
  add column contact_category text,
  add column outcome          text,
  add column rejection_reason text,
  add column rejection_note   text;

-- ---------------------------------------------------------------
-- A. properties — temperatura leada + wiek statusu
-- ---------------------------------------------------------------
alter table public.properties
  add column lead_temperature  text,
  add column status_changed_at timestamptz;

-- Backfill: ostatnia zalogowana zmiana statusu per nieruchomość
-- (PATCH loguje 'updated' z details = body), fallback: updated_at.
update public.properties p
set status_changed_at = coalesce(
  (
    select max(al.created_at)
    from public.activity_log al
    where al.property_id = p.id
      and al.action = 'updated'
      and al.details ? 'status'
  ),
  p.updated_at
);

alter table public.properties
  alter column status_changed_at set default now(),
  alter column status_changed_at set not null;

-- Od teraz znacznik utrzymuje baza — niezależnie od tego, którą
-- ścieżką (API/skrypt) zmieni się status.
create or replace function public.touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger set_properties_status_changed_at
  before update on public.properties
  for each row execute function public.touch_status_changed_at();

-- ---------------------------------------------------------------
-- B. daily_reports — raport dzienny agenta
-- content = spostrzeżenia (sekcja CEL DNIA — REALIZACJA);
-- reszta raportu składa się automatycznie z zadań.
-- submitted_at = moment kliknięcia „Prześlij raport".
-- ---------------------------------------------------------------
create table public.daily_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade on update cascade,
  date         date not null,
  content      text not null default '',
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, date)
);

create index daily_reports_user_id_date_idx on public.daily_reports (user_id, date desc);

create trigger set_daily_reports_updated_at
  before update on public.daily_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- B. missed_report_acks — potwierdzenia „wiem, że nie przesłałem
-- raportu". Jedno na (user, dzień raportu); liczone per miesiąc
-- do ewaluacji.
-- ---------------------------------------------------------------
create table public.missed_report_acks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade on update cascade,
  report_date date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, report_date)
);

create index missed_report_acks_user_id_date_idx on public.missed_report_acks (user_id, report_date desc);

-- ---------------------------------------------------------------
-- Uprawnienia i RLS (granty z 0004 objęły tylko istniejące tabele)
-- ---------------------------------------------------------------
grant select, insert, update, delete on public.daily_reports, public.missed_report_acks to authenticated;
grant all on public.daily_reports, public.missed_report_acks to service_role;

alter table public.daily_reports enable row level security;
alter table public.missed_report_acks enable row level security;

-- Własny raport: pełna kontrola. Cudzy: odczyt dla admina
-- i managera widzącego usera w team_visibility.
create policy "daily_reports_select" on public.daily_reports
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.team_visibility tv
      where tv.manager_id = (select auth.uid()) and tv.member_id = user_id
    )
  );

create policy "daily_reports_insert" on public.daily_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "daily_reports_update" on public.daily_reports
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "missed_report_acks_select" on public.missed_report_acks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.team_visibility tv
      where tv.manager_id = (select auth.uid()) and tv.member_id = user_id
    )
  );

create policy "missed_report_acks_insert" on public.missed_report_acks
  for insert to authenticated
  with check (user_id = (select auth.uid()));
