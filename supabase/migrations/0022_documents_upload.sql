-- =============================================================
-- 0022 — wgrywanie plików dokumentów do CRM (nie tylko linki Drive)
--
-- Dotąd dokumenty nieruchomości to był wyłącznie wklejony link (Google
-- Drive) — plik z restrykcyjnym udostępnieniem był nieczytelny dla reszty
-- zespołu (trzeba było być zalogowanym na konto właściciela Drive).
--
-- Teraz plik można wgrać do prywatnego bucketa 'documents' (0003), a
-- aplikacja serwuje go przez podpisany link tylko zalogowanym userom.
-- storage_path = ścieżka w buckecie; file_url zostaje dla linków zewn.
--
-- Idempotentna.
-- =============================================================

alter table public.documents
  add column if not exists storage_path text;

-- file_url przestaje być wymagane — plik wgrany ma storage_path zamiast linku
alter table public.documents
  alter column file_url drop not null;

-- Prywatny bucket 'documents' + polityki (idempotentnie, na wypadek gdyby
-- migracja 0003 nie była zaaplikowana na tej bazie).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_bucket_select" on storage.objects;
create policy "documents_bucket_select" on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists "documents_bucket_insert" on storage.objects;
create policy "documents_bucket_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "documents_bucket_delete" on storage.objects;
create policy "documents_bucket_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');
