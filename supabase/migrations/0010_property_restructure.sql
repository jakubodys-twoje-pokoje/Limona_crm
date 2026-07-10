-- =============================================================
-- 0010 — restrukturyzacja nieruchomości
--
-- Zamienia jeden ogólny status na dwa niezależne tory: status
-- dłużnika i status inwestora. Lokalizacja rozbita na osobne pola
-- (adres/kod pocztowy/miasto) pod wyszukiwanie. Wartości finansowe:
-- dochodzi wartość realna, taksa notarialna/prowizja/ręczna oferta
-- zastąpione elastyczną listą kosztów (jsonb). Opis KW zastąpiony
-- komentarzami per dział KW. Nowe tabele: negocjacje (notatki) i
-- inwestorzy (per-nieruchomość status inwestora, powiązany z
-- kontaktami — stąd nowy typ kontaktu 'inwestor').
--
-- UWAGA — utrata danych: kolumny location, trello_link,
-- lead_temperature, contact_type, commission_pct, notary_fee,
-- manual_offer, kw_opis, source, status są usuwane trwale.
-- Jeśli w bazie są rekordy z wartościami w tych kolumnach, przed
-- uruchomieniem tej migracji rozważ ich eksport.
-- =============================================================

-- ---------------------------------------------------------------
-- properties — nowe kolumny
-- ---------------------------------------------------------------
alter table public.properties
  add column adres                 text,
  add column kod_pocztowy          text,
  add column miasto                text,
  add column wartosc_realna        numeric(14,2),
  add column koszty_dodatkowe      jsonb not null default '[]'::jsonb,
  add column status_dluznika       text not null default 'brak',
  add column status_inwestora      text not null default 'brak',
  add column pietro_z_ilu          integer,
  add column kw_dzial1_komentarz   text,
  add column kw_dzial2_komentarz   text,
  add column kw_dzial3_komentarz   text,
  add column kw_dzial4_komentarz   text;

-- Backfill adres z dotychczasowego location (best effort — jedno pole
-- w całości trafia do adresu, kod/miasto zostają puste do uzupełnienia)
update public.properties set adres = location where adres is null;

alter table public.properties
  alter column adres set not null;

-- Rename: operat szacunkowy -> wycena szacunkowa (ta sama kolumna)
alter table public.properties rename column operat_szacunkowy to wycena_szacunkowa;

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
  drop column location,
  drop column trello_link,
  drop column lead_temperature,
  drop column contact_type,
  drop column commission_pct,
  drop column notary_fee,
  drop column manual_offer,
  drop column kw_opis,
  drop column source,
  drop column status;

create index properties_status_dluznika_idx on public.properties (status_dluznika);
create index properties_status_inwestora_idx on public.properties (status_inwestora);
create index properties_miasto_idx on public.properties (miasto);

-- ---------------------------------------------------------------
-- property_negotiation_notes — zakładka "Negocjacja" (notatki)
-- ---------------------------------------------------------------
create table public.property_negotiation_notes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  user_id     uuid references public.profiles(id) on delete set null on update cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index property_negotiation_notes_property_id_idx on public.property_negotiation_notes (property_id);

grant select, insert, update, delete on public.property_negotiation_notes to authenticated;
grant all on public.property_negotiation_notes to service_role;

alter table public.property_negotiation_notes enable row level security;
create policy "property_negotiation_notes_select" on public.property_negotiation_notes for select to authenticated using (true);
create policy "property_negotiation_notes_insert" on public.property_negotiation_notes for insert to authenticated
  with check (user_id = (select auth.uid()));
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
create table public.property_investors (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  kontakt_id  uuid not null references public.kontakty(id) on delete cascade on update cascade,
  status      text not null default 'zainteresowany',
  created_by  uuid references public.profiles(id) on delete set null on update cascade,
  created_at  timestamptz not null default now(),
  unique (property_id, kontakt_id)
);

create index property_investors_property_id_idx on public.property_investors (property_id);
create index property_investors_kontakt_id_idx on public.property_investors (kontakt_id);

grant select, insert, update, delete on public.property_investors to authenticated;
grant all on public.property_investors to service_role;

alter table public.property_investors enable row level security;
create policy "property_investors_select" on public.property_investors for select to authenticated using (true);
create policy "property_investors_insert" on public.property_investors for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "property_investors_update" on public.property_investors for update to authenticated
  using (true) with check (true);
create policy "property_investors_delete" on public.property_investors for delete to authenticated
  using (true);
