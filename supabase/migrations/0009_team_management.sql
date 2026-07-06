-- =============================================================
-- 0009 — zarządzanie zespołem dostępne też dla kierownika centrali
--
-- team_visibility_insert/delete były zamknięte na public.is_admin().
-- Zarządzanie regułami manager<->członek ma teraz sens także dla
-- kierownik_centrali (widzi/organizuje wszystkie zespoły z centrali,
-- bez pełnych uprawnień admina do kont). Zwykły manager NIE dostaje
-- tego uprawnienia — jest podmiotem tych reguł, nie ich autorem.
-- =============================================================

create or replace function public.can_manage_teams()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin', 'kierownik_centrali'), false)
$$;

grant execute on function public.can_manage_teams() to authenticated;

drop policy if exists "team_visibility_insert" on public.team_visibility;
create policy "team_visibility_insert" on public.team_visibility
  for insert to authenticated
  with check (public.can_manage_teams() and created_by = (select auth.uid()));

drop policy if exists "team_visibility_delete" on public.team_visibility;
create policy "team_visibility_delete" on public.team_visibility
  for delete to authenticated
  using (public.can_manage_teams());
