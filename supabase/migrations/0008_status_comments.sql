-- =============================================================
-- 0008 — komentarze uzasadniające zmianę statusu (properties, leads)
--
-- Task i Kontakt mają już wątki komentarzy (task_comments,
-- kontakt_komentarze) — od teraz API wymaga komentarza przy każdej
-- zmianie statusu/decyzji (patrz walidacja w route'ach, nie w bazie:
-- baza tylko przechowuje wątek, reguła "wymagany komentarz" żyje
-- w API, tak jak reszta reguł biznesowych w tym projekcie).
--
-- properties i leads takiego wątku nie miały — dokładamy analogiczne
-- tabele, spójne wzorcem z task_comments/kontakt_komentarze.
-- =============================================================

create table public.property_comments (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  user_id     uuid references public.profiles(id) on delete set null on update cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index property_comments_property_id_idx on public.property_comments (property_id);
create index property_comments_created_at_idx on public.property_comments (created_at desc);

create table public.lead_comments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade on update cascade,
  user_id    uuid references public.profiles(id) on delete set null on update cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index lead_comments_lead_id_idx on public.lead_comments (lead_id);
create index lead_comments_created_at_idx on public.lead_comments (created_at desc);

grant select, insert, update, delete on public.property_comments, public.lead_comments to authenticated;
grant all on public.property_comments, public.lead_comments to service_role;

alter table public.property_comments enable row level security;
create policy "property_comments_select" on public.property_comments for select to authenticated using (true);
create policy "property_comments_insert" on public.property_comments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "property_comments_delete" on public.property_comments for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

alter table public.lead_comments enable row level security;
create policy "lead_comments_select" on public.lead_comments for select to authenticated using (true);
create policy "lead_comments_insert" on public.lead_comments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "lead_comments_delete" on public.lead_comments for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Uwaga: rola 'kierownik_centrali' NIE wymaga migracji — profiles.role
-- to zwykły text bez CHECK constraint (konwencja tego projektu: enumy
-- trzymane jako string, walidowane w aplikacji/TS, nie w bazie).
