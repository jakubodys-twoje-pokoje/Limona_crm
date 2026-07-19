-- =============================================================
-- 0022 — kontakt_komentarze: edycja komentarzy
--  * updated_at — znacznik „edytowano" pokazywany w UI
--  * polityka RLS update: autor lub admin (delete już tak działa)
-- =============================================================

alter table public.kontakt_komentarze
  add column if not exists updated_at timestamptz;

drop policy if exists "kontakt_komentarze_update" on public.kontakt_komentarze;
create policy "kontakt_komentarze_update" on public.kontakt_komentarze for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
