-- =============================================================
-- 0029 — powiązanie zadań z leadami
--
-- Zadania można było przypisać do nieruchomości (property_id) lub
-- kontaktu (kontakt_id). Teraz można je też powiązać z leadem, żeby
-- z karty leada dodawać i prowadzić zadania tak samo jak na kartach
-- nieruchomości i kontaktów.
--
-- Nazwa constraintu (tasks_lead_id_fkey) zgodna z konwencją pozostałych
-- FK w tabeli tasks — używana w joinach PostgREST.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

alter table public.tasks
  add column if not exists lead_id uuid;

alter table public.tasks
  drop constraint if exists tasks_lead_id_fkey;
alter table public.tasks
  add constraint tasks_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete cascade on update cascade;

create index if not exists tasks_lead_id_idx on public.tasks (lead_id);
