-- =============================================================
-- 0027 — leads: współrzędne do mapy
--  Geokodowane z pola location przy tworzeniu/edycji leada;
--  leady bez lokalizacji mają null i nie pojawiają się na mapie.
-- =============================================================

alter table public.leads
  add column if not exists lat double precision,
  add column if not exists lng double precision;
