-- Opcjonalna godzina terminu zadania — umożliwia widok dnia w kalendarzu
-- jako siatkę godzinową (jak Google Calendar). Zadania bez due_time
-- (większość istniejących) traktowane są jako "cały dzień".
alter table tasks
  add column if not exists due_time time;
