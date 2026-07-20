-- =============================================================
-- 0024 — daily_reports: edycja po przesłaniu
--  Raport można nadpisywać do północy dnia, którego dotyczy;
--  edited_at znaczy, że treść zmieniła się po pierwszym przesłaniu
--  (submitted_at zostaje pierwotne — widać, o której wysłano).
-- =============================================================

alter table public.daily_reports
  add column if not exists edited_at timestamptz;
