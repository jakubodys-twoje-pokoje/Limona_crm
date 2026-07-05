-- =============================================================
-- 0004_rls — Row Level Security na wszystkich tabelach
--
-- Dostęp do danych idzie przez API routes z sesją użytkownika,
-- więc polityki odwzorowują DZISIEJSZĄ autoryzację aplikacji
-- (stan route'ów przed migracją), a nie wymarzoną:
--  * properties / tasks / research_queries / wall_messages:
--    pełny CRUD dla każdego zalogowanego (filtr visibleIds był
--    zawsze filtrem klienckim, nie autoryzacją),
--  * notifications / wall_reads: tylko własne wiersze,
--  * team_visibility: zapis tylko admin,
--  * profiles: edycja self-or-admin; zmiana ROLI tylko admin
--    (świadome domknięcie dziury z PATCH /api/profiles/[id]).
-- Service role omija RLS — używany tylko w skryptach i endpointach
-- administracyjnych (tworzenie/usuwanie kont), nigdy z sesją usera.
-- =============================================================

-- Uprawnienia bazowe: aplikacja działa wyłącznie jako `authenticated`
-- (żadnych zapytań anonimowych), skrypty jako `service_role`.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------
-- Helpery (security definer — omijają RLS przy odczycie roli,
-- co zapobiega rekursji polityk na profiles)
-- ---------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

grant execute on function public.current_user_role(), public.is_admin() to authenticated;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- INSERT tylko przez trigger on_auth_user_created (security definer)
-- lub service role — brak polityki INSERT dla authenticated.

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (
    public.is_admin()
    or (id = (select auth.uid()) and role = public.current_user_role())
  );

create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (public.is_admin() and id <> (select auth.uid()));

-- ---------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------
alter table public.properties enable row level security;

create policy "properties_select" on public.properties
  for select to authenticated using (true);

create policy "properties_insert" on public.properties
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "properties_update" on public.properties
  for update to authenticated using (true) with check (true);

create policy "properties_delete" on public.properties
  for delete to authenticated using (true);

-- ---------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select to authenticated using (true);

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "tasks_update" on public.tasks
  for update to authenticated using (true) with check (true);

create policy "tasks_delete" on public.tasks
  for delete to authenticated using (true);

-- ---------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------
alter table public.activity_log enable row level security;

create policy "activity_log_select" on public.activity_log
  for select to authenticated using (true);

create policy "activity_log_insert" on public.activity_log
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------
alter table public.documents enable row level security;

create policy "documents_select" on public.documents
  for select to authenticated using (true);

create policy "documents_insert" on public.documents
  for insert to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "documents_update" on public.documents
  for update to authenticated using (true) with check (true);

create policy "documents_delete" on public.documents
  for delete to authenticated using (true);

-- ---------------------------------------------------------------
-- wall_messages (PATCH/DELETE dziś dostępne dla każdego
-- zalogowanego — zachowane 1:1)
-- ---------------------------------------------------------------
alter table public.wall_messages enable row level security;

create policy "wall_messages_select" on public.wall_messages
  for select to authenticated using (true);

create policy "wall_messages_insert" on public.wall_messages
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "wall_messages_update" on public.wall_messages
  for update to authenticated using (true) with check (true);

create policy "wall_messages_delete" on public.wall_messages
  for delete to authenticated using (true);

-- ---------------------------------------------------------------
-- wall_reads
-- ---------------------------------------------------------------
alter table public.wall_reads enable row level security;

create policy "wall_reads_select" on public.wall_reads
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "wall_reads_insert" on public.wall_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------
-- team_visibility
-- ---------------------------------------------------------------
alter table public.team_visibility enable row level security;

create policy "team_visibility_select" on public.team_visibility
  for select to authenticated using (true);

create policy "team_visibility_insert" on public.team_visibility
  for insert to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()));

create policy "team_visibility_delete" on public.team_visibility
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------
alter table public.task_comments enable row level security;

create policy "task_comments_select" on public.task_comments
  for select to authenticated using (true);

create policy "task_comments_insert" on public.task_comments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "task_comments_update" on public.task_comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "task_comments_delete" on public.task_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------
-- notifications (własne do odczytu/oznaczania; tworzyć można
-- powiadomienia dla innych, ale zawsze jako from_user = ja)
-- ---------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (from_user_id = (select auth.uid()));

create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------
-- research_queries
-- ---------------------------------------------------------------
alter table public.research_queries enable row level security;

create policy "research_queries_select" on public.research_queries
  for select to authenticated using (true);

create policy "research_queries_insert" on public.research_queries
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "research_queries_update" on public.research_queries
  for update to authenticated using (true) with check (true);

create policy "research_queries_delete" on public.research_queries
  for delete to authenticated using (true);
