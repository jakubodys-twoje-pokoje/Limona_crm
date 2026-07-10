-- Notatki per zadanie w raporcie dziennym (opcjonalne, mapowane po id
-- zadania) + rozszerzenie widoczności cudzych raportów o kierownika
-- centrali (dotąd tylko admin miał odczyt cudzych raportów poza własnym
-- zespołem — panel przeglądania raportów ma być dostępny też dla centrali).
alter table daily_reports
  add column if not exists task_notes jsonb not null default '{}'::jsonb;

drop policy if exists "daily_reports_select" on public.daily_reports;
create policy "daily_reports_select" on public.daily_reports
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_manage_teams()
    or exists (
      select 1 from public.team_visibility tv
      where tv.manager_id = (select auth.uid()) and tv.member_id = user_id
    )
  );

drop policy if exists "missed_report_acks_select" on public.missed_report_acks;
create policy "missed_report_acks_select" on public.missed_report_acks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_manage_teams()
    or exists (
      select 1 from public.team_visibility tv
      where tv.manager_id = (select auth.uid()) and tv.member_id = user_id
    )
  );
