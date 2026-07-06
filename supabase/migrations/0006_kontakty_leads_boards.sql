-- =============================================================
-- 0006 — port modułów z gałęzi intelligent-mayer:
--   * kontakty (+ komentarze) i mapa
--   * leady
--   * multi-board Kanban (boards / board_lists)
--   * komunikacja (direct_messages / group_messages)
--   * rozszerzone pola properties / tasks / documents / research_queries
-- Addytywne na 0001–0005. RLS spójne z resztą aplikacji
-- (dostęp przez API z sesją → polityki dla authenticated).
-- =============================================================

-- ---------------------------------------------------------------
-- kontakty
-- ---------------------------------------------------------------
create table public.kontakty (
  id                             uuid primary key default gen_random_uuid(),
  typ                            text not null,
  nazwa                          text not null,
  wojewodztwo                    text,
  miasto                         text,
  ulica                          text,
  godziny_otwarcia               text,
  telefon                        text,
  email                          text,
  opis                           text,
  assigned_to                    uuid references public.profiles(id) on delete set null on update cascade,
  oddzial                        text,
  created_by                     uuid references public.profiles(id) on delete set null on update cascade,
  liczba_budynkow                integer,
  liczba_mieszkan                integer,
  wizyta_osobista                boolean not null default false,
  wyslany_mail_oferta            boolean not null default false,
  zgoda_ulotki                   boolean not null default false,
  zgoda_plakat                   boolean not null default false,
  chec_wspolpracy                boolean not null default false,
  niezainteresowani              boolean not null default false,
  operator_budowy_zainteresowani boolean not null default false,
  ustalona_prowizja              text,
  umowa_url                      text,
  lat                            double precision,
  lng                            double precision,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

create index kontakty_typ_idx on public.kontakty (typ);
create index kontakty_assigned_to_idx on public.kontakty (assigned_to);
create index kontakty_created_at_idx on public.kontakty (created_at desc);

create trigger set_kontakty_updated_at
  before update on public.kontakty
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- kontakt_komentarze
-- ---------------------------------------------------------------
create table public.kontakt_komentarze (
  id         uuid primary key default gen_random_uuid(),
  kontakt_id uuid not null references public.kontakty(id) on delete cascade on update cascade,
  user_id    uuid references public.profiles(id) on delete set null on update cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index kontakt_komentarze_kontakt_id_idx on public.kontakt_komentarze (kontakt_id);
create index kontakt_komentarze_created_at_idx on public.kontakt_komentarze (created_at desc);

-- ---------------------------------------------------------------
-- boards / board_lists (multi-Kanban)
-- ---------------------------------------------------------------
create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#84cc16',
  description text,
  created_by  uuid references public.profiles(id) on delete set null on update cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index boards_created_at_idx on public.boards (created_at desc);

create trigger set_boards_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create table public.board_lists (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade on update cascade,
  name     text not null,
  position integer not null default 0
);

create index board_lists_board_id_position_idx on public.board_lists (board_id, position);

-- ---------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------
create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  location    text,
  source      text,
  notes       text,
  status      text not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null on update cascade,
  property_id uuid references public.properties(id) on delete set null on update cascade,
  created_by  uuid references public.profiles(id) on delete set null on update cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_created_at_idx on public.leads (created_at desc);

create trigger set_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- direct_messages / group_messages (komunikacja)
-- ---------------------------------------------------------------
create table public.direct_messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade on update cascade,
  content    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index direct_messages_convo_idx on public.direct_messages (from_id, to_id, created_at desc);
create index direct_messages_inbox_idx on public.direct_messages (to_id, read);

create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null,
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

-- ---------------------------------------------------------------
-- properties — rozszerzone pola + FK do kontaktu
-- ---------------------------------------------------------------
alter table public.properties
  add column deal_type         text,
  add column owner_name        text,
  add column kw_number         text,
  add column kw_opis           text,
  add column source            text,
  add column czynsz_miesieczny numeric(10,2),
  add column pokazywania_count integer not null default 0,
  add column uklad             text,
  add column pietro            integer,
  add column rok_budowy        integer,
  add column balkon_metraz     numeric(6,2),
  add column strony_swiata     text,
  add column operat_szacunkowy numeric(14,2),
  add column co_assignees      uuid[] not null default '{}',
  add column kontakt_id        uuid references public.kontakty(id) on delete set null on update cascade;

create index properties_kontakt_id_idx on public.properties (kontakt_id);

-- ---------------------------------------------------------------
-- tasks — multi-board + współprzypisani + etap nieruchomości
-- ---------------------------------------------------------------
alter table public.tasks
  add column co_assignees   uuid[] not null default '{}',
  add column board_id       uuid references public.boards(id) on delete set null on update cascade,
  add column list_id        uuid references public.board_lists(id) on delete set null on update cascade,
  add column position       integer not null default 0,
  add column property_stage text;

create index tasks_board_id_idx on public.tasks (board_id);
create index tasks_list_id_idx on public.tasks (list_id);

-- ---------------------------------------------------------------
-- documents — etap + indeks (dotąd bez indeksu na property_id)
-- ---------------------------------------------------------------
alter table public.documents
  add column stage text;

create index documents_property_id_idx on public.documents (property_id);

-- ---------------------------------------------------------------
-- research_queries — nazwa firmy
-- ---------------------------------------------------------------
alter table public.research_queries
  add column company_name text;

-- =============================================================
-- Uprawnienia + RLS dla nowych tabel
-- =============================================================
grant select, insert, update, delete on
  public.kontakty, public.kontakt_komentarze, public.boards, public.board_lists,
  public.leads, public.direct_messages, public.group_messages
  to authenticated;
grant all on
  public.kontakty, public.kontakt_komentarze, public.boards, public.board_lists,
  public.leads, public.direct_messages, public.group_messages
  to service_role;

-- kontakty — pełny CRUD dla każdego zalogowanego (jak properties)
alter table public.kontakty enable row level security;
create policy "kontakty_select" on public.kontakty for select to authenticated using (true);
create policy "kontakty_insert" on public.kontakty for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "kontakty_update" on public.kontakty for update to authenticated using (true) with check (true);
create policy "kontakty_delete" on public.kontakty for delete to authenticated using (true);

-- kontakt_komentarze — jak task_comments
alter table public.kontakt_komentarze enable row level security;
create policy "kontakt_komentarze_select" on public.kontakt_komentarze for select to authenticated using (true);
create policy "kontakt_komentarze_insert" on public.kontakt_komentarze for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "kontakt_komentarze_delete" on public.kontakt_komentarze for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- boards / board_lists — wspólne dla zespołu
alter table public.boards enable row level security;
create policy "boards_select" on public.boards for select to authenticated using (true);
create policy "boards_insert" on public.boards for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "boards_update" on public.boards for update to authenticated using (true) with check (true);
create policy "boards_delete" on public.boards for delete to authenticated using (true);

alter table public.board_lists enable row level security;
create policy "board_lists_select" on public.board_lists for select to authenticated using (true);
create policy "board_lists_insert" on public.board_lists for insert to authenticated with check (true);
create policy "board_lists_update" on public.board_lists for update to authenticated using (true) with check (true);
create policy "board_lists_delete" on public.board_lists for delete to authenticated using (true);

-- leads — pełny CRUD dla zespołu
alter table public.leads enable row level security;
create policy "leads_select" on public.leads for select to authenticated using (true);
create policy "leads_insert" on public.leads for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "leads_update" on public.leads for update to authenticated using (true) with check (true);
create policy "leads_delete" on public.leads for delete to authenticated using (true);

-- direct_messages — tylko strony rozmowy
alter table public.direct_messages enable row level security;
create policy "direct_messages_select" on public.direct_messages for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
create policy "direct_messages_insert" on public.direct_messages for insert to authenticated
  with check (from_id = (select auth.uid()));
create policy "direct_messages_update" on public.direct_messages for update to authenticated
  using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()));

-- group_messages — czytają wszyscy zalogowani, pisze autor jako on sam
alter table public.group_messages enable row level security;
create policy "group_messages_select" on public.group_messages for select to authenticated using (true);
create policy "group_messages_insert" on public.group_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "group_messages_delete" on public.group_messages for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
