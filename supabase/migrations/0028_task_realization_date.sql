-- =============================================================
-- 0028 — data realizacji zadania „w trakcie"
--
-- Gdy zadanie jest w trakcie (np. po rozmowie z klientem termin
-- został przełożony albo z rozmowy wynikła kolejna czynność w tej
-- samej sprawie), agent może wpisać dodatkową DATĘ REALIZACJI —
-- planowany dzień domknięcia/następnego kroku. Jest to pole odrębne
-- od due_date (terminu), żeby nie nadpisywać pierwotnego terminu.
--
-- W raporcie dziennym zadania „w trakcie" z ustawioną datą realizacji
-- pokazują tę datę, więc nie są odbierane po prostu jako „niezrobione",
-- tylko jako przełożone/zaplanowane.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.tasks
  add column if not exists realization_date date;

create index if not exists tasks_realization_date_idx on public.tasks (realization_date);
