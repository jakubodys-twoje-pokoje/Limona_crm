-- =============================================================
-- 0038 — token subskrypcji kalendarza (feed ICS) per user
--
-- Najprostsza możliwa synchronizacja z Google/Apple/Outlook Calendar bez
-- OAuth i „łączenia konta": każdy user ma tajny token, z którego budujemy
-- prywatny adres feedu ICS (/api/calendar/<token>). User dodaje ten adres
-- RAZ w swoim kalendarzu („Dodaj kalendarz → z adresu URL"), a kalendarz
-- sam go odświeża. Jednokierunkowo (CRM → kalendarz), tylko do odczytu.
--
-- Token można wygenerować od nowa (unieważnia stary adres) — patrz
-- /api/calendar/reset.
-- Idempotentna.
-- =============================================================

create extension if not exists pgcrypto;

-- gen_random_uuid() jest volatile — przy dodaniu kolumny z tym defaultem
-- Postgres nadaje każdemu istniejącemu wierszowi własny, unikalny token.
alter table public.profiles add column if not exists calendar_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_calendar_token_idx on public.profiles (calendar_token);
