-- =============================================================
-- 0023 — properties: źródło tematu
--  Skąd pochodzi temat (OLX, polecenie, komornik, oszacowania…) —
--  do tej pory nie było gdzie tego zaznaczyć.
-- =============================================================

alter table public.properties
  add column if not exists zrodlo text;
