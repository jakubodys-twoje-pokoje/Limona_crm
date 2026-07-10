-- =============================================================
-- 0011 — kontakty: zadania per kontakt, godziny per dzień,
-- widoczność per-user + udostępnianie, usunięcie danych zasobu
--
-- * tasks.kontakt_id — zadania można teraz przypisać do kontaktu,
--   niezależnie od nieruchomości (property_id nadal opcjonalne).
-- * kontakty.godziny_otwarcia — z wolnego tekstu na jsonb
--   {poniedzialek: "9:00-17:00", wtorek: ..., ..., niedziela: ...}
--   (UWAGA — utrata danych: dotychczasowa wartość tekstowa nie da
--   się bezpiecznie sparsować na strukturę, więc kolumna jest
--   zerowana; jeśli mieliście tam ważne dane, zanotujcie je przed
--   uruchomieniem tej migracji).
-- * liczba_budynkow / liczba_mieszkan — usunięte trwale ("dane
--   zasobu" wypadają z formularza kontaktu).
-- * kontakt_shares — jawne udostępnianie konkretnego kontaktu
--   innemu userowi (niezależnie od hierarchii team_visibility).
--   Widoczność per-user egzekwowana w API (GET /api/kontakty),
--   nie w RLS — konwencja tego projektu (patrz properties/tasks).
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

-- ---------------------------------------------------------------
-- tasks.kontakt_id
-- ---------------------------------------------------------------
alter table public.tasks
  add column if not exists kontakt_id uuid references public.kontakty(id) on delete set null on update cascade;

create index if not exists tasks_kontakt_id_idx on public.tasks (kontakt_id);

-- ---------------------------------------------------------------
-- kontakty.godziny_otwarcia: text -> jsonb (per dzień tygodnia)
-- ---------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kontakty'
      and column_name = 'godziny_otwarcia' and data_type <> 'jsonb'
  ) then
    alter table public.kontakty drop column godziny_otwarcia;
  end if;
end $$;

alter table public.kontakty
  add column if not exists godziny_otwarcia jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------
-- kontakty — usunięcie danych zasobu
-- ---------------------------------------------------------------
alter table public.kontakty
  drop column if exists liczba_budynkow,
  drop column if exists liczba_mieszkan;

-- ---------------------------------------------------------------
-- kontakt_shares — jawne udostępnienie kontaktu innemu userowi
-- ---------------------------------------------------------------
create table if not exists public.kontakt_shares (
  id                   uuid primary key default gen_random_uuid(),
  kontakt_id           uuid not null references public.kontakty(id) on delete cascade on update cascade,
  shared_with_user_id  uuid not null references public.profiles(id) on delete cascade on update cascade,
  created_by           uuid references public.profiles(id) on delete set null on update cascade,
  created_at           timestamptz not null default now(),
  unique (kontakt_id, shared_with_user_id)
);

create index if not exists kontakt_shares_kontakt_id_idx on public.kontakt_shares (kontakt_id);
create index if not exists kontakt_shares_shared_with_idx on public.kontakt_shares (shared_with_user_id);

grant select, insert, update, delete on public.kontakt_shares to authenticated;
grant all on public.kontakt_shares to service_role;

alter table public.kontakt_shares enable row level security;

drop policy if exists "kontakt_shares_select" on public.kontakt_shares;
create policy "kontakt_shares_select" on public.kontakt_shares for select to authenticated using (true);

drop policy if exists "kontakt_shares_insert" on public.kontakt_shares;
create policy "kontakt_shares_insert" on public.kontakt_shares for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "kontakt_shares_delete" on public.kontakt_shares;
create policy "kontakt_shares_delete" on public.kontakt_shares for delete to authenticated using (true);
