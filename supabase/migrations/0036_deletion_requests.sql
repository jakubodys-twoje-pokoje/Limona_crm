-- =============================================================
-- 0036 — prośby o usunięcie rekordów
--
-- Zwykli użytkownicy nie usuwają leadów / kontaktów / nieruchomości sami —
-- zgłaszają prośbę z uzasadnieniem, a centrala (admin / kierownik centrali)
-- zatwierdza (rekord zostaje usunięty) albo odrzuca na osobnym ekranie.
--
-- entity_label trzymamy „na sztywno" (nazwa/adres z chwili zgłoszenia), żeby
-- ekran centrali był czytelny nawet po usunięciu rekordu.
--
-- Idempotentna — bezpieczna do wielokrotnego uruchomienia.
-- =============================================================

create table if not exists public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('lead', 'kontakt', 'property')),
  entity_id    uuid not null,
  entity_label text,
  reason       text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.profiles(id) on delete set null on update cascade,
  reviewed_by  uuid references public.profiles(id) on delete set null on update cascade,
  review_note  text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists deletion_requests_status_idx on public.deletion_requests (status, created_at desc);
-- Jedna otwarta prośba na rekord — kolejne zgłoszenie tego samego nie tworzy duplikatu
create unique index if not exists deletion_requests_pending_uniq
  on public.deletion_requests (entity_type, entity_id) where status = 'pending';

grant select, insert, update, delete on public.deletion_requests to authenticated;
grant all on public.deletion_requests to service_role;

alter table public.deletion_requests enable row level security;

-- Odczyt: swoje zgłoszenia (żeby widzieć status) + pełny wgląd dla centrali.
drop policy if exists "deletion_requests_select" on public.deletion_requests;
create policy "deletion_requests_select" on public.deletion_requests
  for select to authenticated
  using (
    requested_by = (select auth.uid())
    or public.current_user_role() in ('admin', 'kierownik_centrali')
  );

-- Zgłaszać może każdy zalogowany — we własnym imieniu.
drop policy if exists "deletion_requests_insert" on public.deletion_requests;
create policy "deletion_requests_insert" on public.deletion_requests
  for insert to authenticated
  with check (requested_by = (select auth.uid()));

-- Rozpatrywać (zatwierdzać/odrzucać) mogą tylko admin i kierownik centrali.
drop policy if exists "deletion_requests_update" on public.deletion_requests;
create policy "deletion_requests_update" on public.deletion_requests
  for update to authenticated
  using (public.current_user_role() in ('admin', 'kierownik_centrali'))
  with check (public.current_user_role() in ('admin', 'kierownik_centrali'));
