-- =============================================================
-- 0003_storage — prywatny bucket `documents`
-- Feature dokumentów nie ma jeszcze UI/API (model istniał tylko
-- w schemacie) — bucket i polityki są przygotowane pod przyszły
-- upload przez signed URLs, spójnie z RLS tabeli documents
-- (każdy zalogowany czyta i pisze).
-- =============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_bucket_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents_bucket_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

create policy "documents_bucket_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

create policy "documents_bucket_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents');
