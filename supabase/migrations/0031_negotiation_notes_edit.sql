-- =============================================================
-- 0031 — edycja notatek negocjacyjnych (Nieruchomości → Negocjacje)
--
-- Notatki można było tylko dodawać i usuwać. Teraz autor (oraz admin)
-- może też edytować treść komentarza. Dodajemy kolumnę updated_at i
-- brakującą politykę RLS na UPDATE (dotąd tabela miała tylko select/
-- insert/delete, więc każdy UPDATE był blokowany).
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.property_negotiation_notes
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "property_negotiation_notes_update" on public.property_negotiation_notes;
create policy "property_negotiation_notes_update" on public.property_negotiation_notes for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
