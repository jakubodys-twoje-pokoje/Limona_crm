-- =============================================================
-- 0030 — status „zrezygnował" i archiwizacja nieruchomości
--
-- Gdy klient zrezygnuje, nieruchomość dostaje status dłużnika
-- „zrezygnowal" i trafia do archiwum (properties.archived_at = now()).
-- Zarchiwizowane nieruchomości znikają z aktywnej listy, mapy i pickerów,
-- a po maksymalnie 30 dniach są trwale usuwane (czyszczenie leniwe przy
-- listowaniu — patrz GET /api/properties).
--
-- status_dluznika to zwykły text (bez CHECK), więc nowa wartość nie wymaga
-- zmiany ograniczeń — wystarczy kolumna archived_at.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.properties
  add column if not exists archived_at timestamptz;

create index if not exists properties_archived_at_idx on public.properties (archived_at);
