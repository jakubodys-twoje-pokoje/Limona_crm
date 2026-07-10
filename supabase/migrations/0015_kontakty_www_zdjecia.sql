-- Strona www kontaktu + galeria zdjęć (max 5, egzekwowane w API, nie w bazie
-- — konwencja projektu: walidacje trzymamy w TS, nie w CHECK constraints).
alter table kontakty
  add column if not exists www text,
  add column if not exists zdjecia text[] not null default '{}';

-- Bucket na zdjęcia kontaktów — publiczny odczyt (miniatury w UI bez
-- podpisanych URL-i), zapis/usuwanie tylko dla zalogowanych.
insert into storage.buckets (id, name, public)
values ('kontakt-zdjecia', 'kontakt-zdjecia', true)
on conflict (id) do nothing;

drop policy if exists "kontakt_zdjecia_select" on storage.objects;
create policy "kontakt_zdjecia_select" on storage.objects
  for select to public
  using (bucket_id = 'kontakt-zdjecia');

drop policy if exists "kontakt_zdjecia_insert" on storage.objects;
create policy "kontakt_zdjecia_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kontakt-zdjecia');

drop policy if exists "kontakt_zdjecia_delete" on storage.objects;
create policy "kontakt_zdjecia_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kontakt-zdjecia');
