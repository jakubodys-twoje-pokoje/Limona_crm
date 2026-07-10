-- =============================================================
-- 0012 — pole "rejon" dla użytkowników
--
-- Rejon = miasto przypisane do użytkownika (jego obszar działania).
-- Używane jako domyślne miasto przy dodawaniu nowej nieruchomości
-- i jako domyślny środek mapy dla tego użytkownika.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.profiles
  add column if not exists rejon      text,
  add column if not exists rejon_lat  double precision,
  add column if not exists rejon_lng  double precision;
