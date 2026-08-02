-- =============================================================
-- 0034 — edycja komentarzy nieruchomości
--
-- Komentarze można było dodawać i usuwać, ale nie edytować (brak kolumny
-- updated_at i brak polityki RLS UPDATE — każdy UPDATE był blokowany).
-- Teraz autor (oraz admin) może też edytować treść własnego komentarza.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.property_comments
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "property_comments_update" on public.property_comments;
create policy "property_comments_update" on public.property_comments for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
