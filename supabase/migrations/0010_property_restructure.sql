-- =============================================================
-- 0010 — restrukturyzacja nieruchomości
--
-- Zamienia jeden ogólny status na dwa niezależne tory: status
-- dłużnika i status inwestora. Lokalizacja rozbita na osobne pola
-- (adres/kod pocztowy/miasto) pod wyszukiwanie. Wartości finansowe:
-- dochodzi wartość realna; suma zadłużenia przestaje być jednym
-- wpisywanym na raz polem — zamiast tego elastyczna lista pozycji
-- zadłużenia (jsonb: etykieta + kwota, dowolna liczba pozycji),
-- z automatyczną sumą. Taksa notarialna/prowizja/ręczna oferta
-- znikają jako osobne pola (bez zamiennika — kalkulator liczy je
-- teraz tylko w samodzielnym narzędziu /kalkulator). Opis KW
-- zastąpiony komentarzami per dział KW. Nowe tabele: negocjacje
-- (notatki) i inwestorzy (per-nieruchomość status inwestora,
-- powiązany z kontaktami — stąd nowy typ kontaktu 'inwestor').
--
-- UWAGA — utrata danych: kolumny location, trello_link,
-- lead_temperature, contact_type, commission_pct, notary_fee,
-- manual_offer, kw_opis, source, status są usuwane trwale.
-- Jeśli w bazie są rekordy z wartościami w tych kolumnach, przed
-- uruchomieniem tej migracji rozważ ich eksport.
--
-- Ta migracja jest bezpieczna do wielokrotnego uruchomienia
-- (idempotentna) — każdy krok sprawdza aktualny stan przed
-- wykonaniem, więc można ją ponownie wkleić po nieudanej/częściowej
-- wcześniejszej próbie bez błędów w stylu "column already exists".
-- =============================================================

-- ---------------------------------------------------------------
-- properties — nowe kolumny
-- ---------------------------------------------------------------
alter table public.properties
  add column if not exists adres                 text,
  add column if not exists kod_pocztowy           text,
  add column if not exists miasto                 text,
  add column if not exists wartosc_realna         numeric(14,2),
  add column if not exists status_dluznika        text not null default 'brak',
  add column if not exists status_inwestora       text not null default 'brak',
  add column if not exists pietro_z_ilu           integer,
  add column if not exists kw_dzial1_komentarz    text,
  add column if not exists kw_dzial2_komentarz    text,
  add column if not exists kw_dzial3_komentarz    text,
  add column if not exists kw_dzial4_komentarz    text;

-- Wcześniejsza wersja tej migracji nazywała tę kolumnę koszty_dodatkowe —
-- jeśli została już utworzona pod starą nazwą, przemianuj zamiast dublować.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'koszty_dodatkowe')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'zadluzenia') then
    alter table public.properties rename column koszty_dodatkowe to zadluzenia;
  end if;
end $$;

alter table public.properties
  add column if not exists zadluzenia jsonb not null default '[]'::jsonb;

-- Backfill adres z dotychczasowego location (best effort — jedno pole
-- w całości trafia do adresu, kod/miasto zostają puste do uzupełnienia).
-- Kolumna location mogła już zostać usunięta w poprzedniej próbie —
-- w takim wypadku ten krok jest pomijany.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'location') then
    update public.properties set adres = location where adres is null;
  end if;
end $$;

-- Puste adresy (np. rekordy bez dawnego location) dostają placeholder,
-- żeby constraint not null nie wywalił migracji na istniejących danych.
update public.properties set adres = '(brak adresu)' where adres is null;

alter table public.properties
  alter column adres set not null;

-- Rename: operat szacunkowy -> wycena szacunkowa (ta sama kolumna)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'operat_szacunkowy')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'wycena_szacunkowa') then
    alter table public.properties rename column operat_szacunkowy to wycena_szacunkowa;
  end if;
end $$;

alter table public.properties
  add column if not exists wycena_szacunkowa numeric(14,2);

-- Trigger na status_changed_at odwoływał się do kolumny `status` —
-- przepinamy na oba nowe tory statusu.
create or replace function public.touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status_dluznika is distinct from old.status_dluznika
     or new.status_inwestora is distinct from old.status_inwestora then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

-- Usunięcie pól wycofanych z formularza/UI
alter table public.properties
  drop column if exists location,
  drop column if exists trello_link,
  drop column if exists lead_temperature,
  drop column if exists contact_type,
  drop column if exists commission_pct,
  drop column if exists notary_fee,
  drop column if exists manual_offer,
  drop column if exists kw_opis,
  drop column if exists source,
  drop column if exists status;

create index if not exists properties_status_dluznika_idx on public.properties (status_dluznika);
create index if not exists properties_status_inwestora_idx on public.properties (status_inwestora);
create index if not exists properties_miasto_idx on public.properties (miasto);

-- ---------------------------------------------------------------
-- property_negotiation_notes — zakładka "Negocjacja" (notatki)
-- ---------------------------------------------------------------
create table if not exists public.property_negotiation_notes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  user_id     uuid references public.profiles(id) on delete set null on update cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists property_negotiation_notes_property_id_idx on public.property_negotiation_notes (property_id);

grant select, insert, update, delete on public.property_negotiation_notes to authenticated;
grant all on public.property_negotiation_notes to service_role;

alter table public.property_negotiation_notes enable row level security;

drop policy if exists "property_negotiation_notes_select" on public.property_negotiation_notes;
create policy "property_negotiation_notes_select" on public.property_negotiation_notes for select to authenticated using (true);

drop policy if exists "property_negotiation_notes_insert" on public.property_negotiation_notes;
create policy "property_negotiation_notes_insert" on public.property_negotiation_notes for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "property_negotiation_notes_delete" on public.property_negotiation_notes;
create policy "property_negotiation_notes_delete" on public.property_negotiation_notes for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------
-- kontakty.typ — dochodzi 'inwestor' (inwestorzy też są kontaktami)
-- (bez zmian w bazie — typ to zwykły text, walidacja w TS)
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- property_investors — zakładka "Inwestorzy": powiązanie
-- nieruchomość <-> kontakt (typ='inwestor') + status per nieruchomość
-- ---------------------------------------------------------------
create table if not exists public.property_investors (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  kontakt_id  uuid not null references public.kontakty(id) on delete cascade on update cascade,
  status      text not null default 'zainteresowany',
  created_by  uuid references public.profiles(id) on delete set null on update cascade,
  created_at  timestamptz not null default now(),
  unique (property_id, kontakt_id)
);

create index if not exists property_investors_property_id_idx on public.property_investors (property_id);
create index if not exists property_investors_kontakt_id_idx on public.property_investors (kontakt_id);

grant select, insert, update, delete on public.property_investors to authenticated;
grant all on public.property_investors to service_role;

alter table public.property_investors enable row level security;

drop policy if exists "property_investors_select" on public.property_investors;
create policy "property_investors_select" on public.property_investors for select to authenticated using (true);

drop policy if exists "property_investors_insert" on public.property_investors;
create policy "property_investors_insert" on public.property_investors for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "property_investors_update" on public.property_investors;
create policy "property_investors_update" on public.property_investors for update to authenticated
  using (true) with check (true);

drop policy if exists "property_investors_delete" on public.property_investors;
create policy "property_investors_delete" on public.property_investors for delete to authenticated
  using (true);
