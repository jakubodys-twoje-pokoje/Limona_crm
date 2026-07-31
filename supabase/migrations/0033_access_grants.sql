-- =============================================================
-- 0033 — panel dostępów: granty widoczności per kategoria
--
-- Centrala/admin może nadać użytkownikowi (grantee) dostęp do kategorii
-- danych — osobno dla nieruchomości, leadów i każdego typu kontaktu:
--   scope = 'nieruchomosci' | 'leady' | 'kontakt:<typ>'
--   target_user_id = NULL      → cała kategoria (wszyscy właściciele),
--   target_user_id = <user Y>  → rekordy danej kategorii należące do Y.
--
-- Enforcement idzie w filtrach API (RLS na properties/kontakty/leads jest
-- permisywne — patrz 0004). RLS tu chroni samą tabelę grantów: user widzi
-- tylko swoje granty (do enforcementu), a nadawać/cofać mogą admin i
-- kierownik centrali.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

create table if not exists public.access_grants (
  id             uuid primary key default gen_random_uuid(),
  grantee_id     uuid not null references public.profiles(id) on delete cascade on update cascade,
  scope          text not null,
  target_user_id uuid references public.profiles(id) on delete cascade on update cascade,
  created_by     uuid references public.profiles(id) on delete set null on update cascade,
  created_at     timestamptz not null default now()
);

-- Jeden grant per (grantee, scope, target); wariant „cała kategoria"
-- (target NULL) traktujemy jak stały sentinel, żeby też był unikalny.
create unique index if not exists access_grants_uniq
  on public.access_grants (grantee_id, scope, coalesce(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists access_grants_grantee_idx on public.access_grants (grantee_id);

grant select, insert, update, delete on public.access_grants to authenticated;
grant all on public.access_grants to service_role;

alter table public.access_grants enable row level security;

-- Odczyt: swoje granty (do enforcementu w API) + pełny wgląd dla
-- admina/kierownika centrali (panel dostępów).
drop policy if exists "access_grants_select" on public.access_grants;
create policy "access_grants_select" on public.access_grants
  for select to authenticated
  using (
    grantee_id = (select auth.uid())
    or public.current_user_role() in ('admin', 'kierownik_centrali')
  );

-- Nadawać / cofać mogą tylko admin i kierownik centrali.
drop policy if exists "access_grants_insert" on public.access_grants;
create policy "access_grants_insert" on public.access_grants
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'kierownik_centrali'));

drop policy if exists "access_grants_delete" on public.access_grants;
create policy "access_grants_delete" on public.access_grants
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'kierownik_centrali'));
