-- =============================================================
-- 0039 — dział prawny: rozdzielenie zadań prawnych od zwykłych
--
-- 1) Nowa rola konta: 'dzial_prawny' (kolumna profiles.role jest typu
--    text, więc nie ma tu nic do migrowania — rola jest obsługiwana w
--    aplikacji: nawigacja ograniczona do Zadań i Nieruchomości, brak
--    bazy kontaktów i leadów).
--
-- 2) tasks.task_kind — rodzaj zadania:
--      'zwykle' → zwykłe zadanie operacyjne (domyślne, cała historia),
--      'prawne' → zadanie działu prawnego.
--    Na karcie nieruchomości zadania prawne mają własną zakładkę obok
--    zwykłych, a widzą je: osoba przypisana do nieruchomości (przy
--    tworzeniu dopisywana do współwykonawców) oraz każde konto z rolą
--    'dzial_prawny' (filtr w /api/tasks).
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.tasks
  add column if not exists task_kind text not null default 'zwykle';

alter table public.tasks drop constraint if exists tasks_task_kind_check;
alter table public.tasks
  add constraint tasks_task_kind_check check (task_kind in ('zwykle', 'prawne'));

-- Dział prawny listuje wszystkie zadania prawne; karta nieruchomości
-- rozdziela zadania na dwie zakładki po (property_id, task_kind).
create index if not exists tasks_task_kind_idx on public.tasks (task_kind);
create index if not exists tasks_property_kind_idx on public.tasks (property_id, task_kind);
