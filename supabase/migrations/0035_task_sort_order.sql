-- Ręczna kolejność zadań całodniowych (bez godziny) w Terminarzu.
-- Zadania z godziną porządkuje czas; zadania bez godziny agent układa sam
-- (tryb „Edytuj kolejność"), a wybór ma być trwały — stąd kolumna w bazie.
-- Mniejsza wartość = wyżej na liście. Domyślnie 0 (świeże zadania trafiają
-- na górę grupy nieuporządkowanej, do czasu ręcznego ułożenia).
alter table tasks add column if not exists sort_order double precision not null default 0;

-- Wspiera sortowanie „dzień → kolejność ręczna"
create index if not exists tasks_due_sort_idx on tasks (due_date, sort_order);
