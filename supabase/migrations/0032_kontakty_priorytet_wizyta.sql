-- =============================================================
-- 0032 — priorytet potencjału i ostatnia wizyta w bazie kontaktów
--
-- * priorytet — targetowanie kontaktu wg potencjału:
--     A = wysoki priorytet, B = średni (podgrzewać), C = niski.
-- * ostatnia_wizyta — data ostatniej wizyty u kontrahenta; ustawiana
--   ręcznie („Oznacz wizytę") albo automatycznie, gdy zadanie typu
--   „wizyta" powiązane z kontaktem zostaje domknięte. Służy też do
--   filtrowania po aktywności i podświetlania braku aktywności.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.kontakty
  add column if not exists priorytet text,
  add column if not exists ostatnia_wizyta date;

alter table public.kontakty
  drop constraint if exists kontakty_priorytet_check;
alter table public.kontakty
  add constraint kontakty_priorytet_check
  check (priorytet is null or priorytet in ('A', 'B', 'C'));

create index if not exists kontakty_priorytet_idx on public.kontakty (priorytet);
create index if not exists kontakty_ostatnia_wizyta_idx on public.kontakty (ostatnia_wizyta);
