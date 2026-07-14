-- =============================================================
-- 0021 — publiczny bucket `trello-import` na pliki ściągnięte
-- z załączników Trello podczas importu (scripts/import-trello.ts).
--
-- Publiczny odczyt jak kontakt-zdjecia: documents.file_url otwiera
-- się w UI zwykłym linkiem (bez signed URLs), a wgrywać może tylko
-- serwis/zalogowani. Te pliki i tak były dostępne każdemu członkowi
-- tablicy Trello.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('trello-import', 'trello-import', true)
on conflict (id) do nothing;

drop policy if exists "trello_import_select" on storage.objects;
create policy "trello_import_select" on storage.objects
  for select to public
  using (bucket_id = 'trello-import');

drop policy if exists "trello_import_insert" on storage.objects;
create policy "trello_import_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trello-import');
