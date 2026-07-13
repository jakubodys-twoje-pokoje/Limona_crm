-- =============================================================
-- 0019 — zadania cykliczne, oferty inwestorów, motyw użytkownika
--
-- * tasks.recurrence_* — seria zadań cyklicznych. Każde wystąpienie
--   to osobny wiersz (własne komentarze, status, termin) powiązany
--   przez recurrence_parent_id z pierwszym zadaniem serii — dzięki
--   temu notatki/komentarze każdego wystąpienia liczą się oddzielnie.
-- * property_investors.offer_amount — kwota zaoferowana przez
--   inwestora za nieruchomość.
-- * property_negotiation_notes.investor_id — komentarz przypisany
--   do konkretnej oferty inwestora (NULL = ogólna notatka negocjacyjna).
-- * profiles.theme_preference — motyw UI per użytkownik
--   (dark / light / contrast).
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

-- ---------------------------------------------------------------
-- tasks — cykliczność
-- ---------------------------------------------------------------
alter table public.tasks
  add column if not exists recurrence_freq text,
  add column if not exists recurrence_interval integer not null default 1,
  add column if not exists recurrence_until date,
  add column if not exists recurrence_parent_id uuid references public.tasks(id) on delete set null on update cascade;

alter table public.tasks
  drop constraint if exists tasks_recurrence_freq_check;
alter table public.tasks
  add constraint tasks_recurrence_freq_check
  check (recurrence_freq is null or recurrence_freq in ('daily', 'weekly', 'monthly'));

create index if not exists tasks_recurrence_parent_id_idx on public.tasks (recurrence_parent_id);

-- ---------------------------------------------------------------
-- property_investors — kwota oferty
-- ---------------------------------------------------------------
alter table public.property_investors
  add column if not exists offer_amount numeric(14, 2);

-- ---------------------------------------------------------------
-- property_negotiation_notes — komentarz do konkretnej oferty
-- ---------------------------------------------------------------
alter table public.property_negotiation_notes
  add column if not exists investor_id uuid references public.property_investors(id) on delete cascade on update cascade;

create index if not exists property_negotiation_notes_investor_id_idx on public.property_negotiation_notes (investor_id);

-- ---------------------------------------------------------------
-- profiles — motyw interfejsu (per użytkownik)
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists theme_preference text not null default 'dark';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;
alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('dark', 'light', 'contrast'));
