-- =============================================================
-- 0020 — leady v2: pipeline "ironproof"
--
-- * temperature        — gorący/ciepły/zimny (priorytet leada, jak
--                        priority w zadaniach).
-- * next_contact_at    — data następnego kontaktu (follow-up); UI
--                        podświetla przeterminowane jak w zadaniach.
-- * kontakt_id         — po konwersji: klient (kontakt typ='klient')
--                        utworzony z leada. property_id już istnieje.
-- * converted_at       — moment konwersji; konwersja jest stanem
--                        końcowym (API blokuje dalsze zmiany statusu).
-- * meta               — surowy payload z webhooka (n8n) do audytu +
--                        licznik ponownych zgłoszeń tego samego numeru.
-- * indeksy phone/email — deduplikacja przy ręcznym dodawaniu i
--                        ingest z webhooka.
-- * kontakty.typ 'klient' — bez zmian w bazie (typ to text, walidacja
--                        w TS — konwencja projektu, patrz 0008).
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.leads
  add column if not exists temperature text not null default 'warm',
  add column if not exists next_contact_at date,
  add column if not exists kontakt_id uuid references public.kontakty(id) on delete set null on update cascade,
  add column if not exists converted_at timestamptz,
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.leads
  drop constraint if exists leads_temperature_check;
alter table public.leads
  add constraint leads_temperature_check
  check (temperature in ('hot', 'warm', 'cold'));

-- Deduplikacja: szukamy po znormalizowanym numerze (same cyfry) i emailu
create index if not exists leads_phone_idx on public.leads (phone) where phone is not null;
create index if not exists leads_email_idx on public.leads (lower(email)) where email is not null;
create index if not exists leads_kontakt_id_idx on public.leads (kontakt_id);
create index if not exists leads_next_contact_idx on public.leads (next_contact_at) where next_contact_at is not null;
