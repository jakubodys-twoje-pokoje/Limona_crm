-- Dodatkowe dane firmowe kontaktu: NIP, KRS oraz rozmiar organizacji
-- (mała/średnia/duża) — enum trzymany jako plain text, walidowany w TS
-- (konwencja projektu — bez CHECK constraint w bazie).
alter table kontakty
  add column if not exists nip text,
  add column if not exists krs text,
  add column if not exists rozmiar text;
