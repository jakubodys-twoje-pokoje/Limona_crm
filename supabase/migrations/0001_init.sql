-- =============================================================
-- 0001_init — schemat 1:1 z prisma/schema.prisma
-- Tabele, FK, indeksy, defaulty i precyzje numeric bez zmian.
-- Kolumna profiles.password istnieje tu przejściowo — usuwa ją
-- 0002_auth po imporcie użytkowników do Supabase Auth.
-- =============================================================

-- Odpowiednik prismowego @updatedAt (Prisma ustawiała to w kliencie,
-- w Supabase przenosimy do bazy, żeby zachować semantykę).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  password   text not null,
  full_name  text not null,
  avatar_url text,
  role       text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------
create table public.properties (
  id                uuid primary key default gen_random_uuid(),
  location          text not null,
  trello_link       text,
  phone             text,
  contact_type      text,
  property_type     text,
  area_sqm          numeric(10,2),
  value_per_sqm     numeric(14,2),
  total_debt        numeric(14,2) not null default 0,
  debt_type         text,
  creditor1_amount  numeric(14,2) not null default 0,
  creditor2_amount  numeric(14,2) not null default 0,
  creditor3_amount  numeric(14,2) not null default 0,
  owner_coefficient numeric(6,4) not null default 0.025,
  commission_pct    numeric(6,4) not null default 0,
  notary_fee        numeric(10,2) not null default 1000,
  manual_offer      numeric(14,2),
  status            text not null default 'new',
  decision          text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null on update cascade,
  assigned_to       uuid references public.profiles(id) on delete set null on update cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index properties_status_idx on public.properties (status);
create index properties_assigned_to_idx on public.properties (assigned_to);
create index properties_created_at_idx on public.properties (created_at desc);

create trigger set_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties(id) on delete cascade on update cascade,
  title        text not null,
  description  text,
  status       text not null default 'todo',
  priority     text not null default 'medium',
  due_date     date,
  assigned_to  uuid references public.profiles(id) on delete set null on update cascade,
  created_by   uuid references public.profiles(id) on delete set null on update cascade,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tasks_property_id_idx on public.tasks (property_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_idx on public.tasks (status);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade on update cascade,
  task_id     uuid references public.tasks(id) on delete cascade on update cascade,
  user_id     uuid references public.profiles(id) on delete set null on update cascade,
  action      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index activity_log_property_id_idx on public.activity_log (property_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------
-- documents
-- (uploaded_by bez FK — tak samo jak w schemacie Prismy)
-- ---------------------------------------------------------------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade on update cascade,
  name        text not null,
  file_url    text not null,
  file_type   text,
  uploaded_by uuid,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- wall_messages
-- ---------------------------------------------------------------
create table public.wall_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null on update cascade,
  content    text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

create index wall_messages_created_at_idx on public.wall_messages (created_at desc);

-- ---------------------------------------------------------------
-- wall_reads
-- ---------------------------------------------------------------
create table public.wall_reads (
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  message_id uuid not null references public.wall_messages(id) on delete cascade on update cascade,
  read_at    timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index wall_reads_user_id_idx on public.wall_reads (user_id);

-- ---------------------------------------------------------------
-- team_visibility
-- ---------------------------------------------------------------
create table public.team_visibility (
  id         uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade on update cascade,
  created_by uuid references public.profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  unique (manager_id, member_id)
);

create index team_visibility_manager_id_idx on public.team_visibility (manager_id);
create index team_visibility_member_id_idx on public.team_visibility (member_id);

-- ---------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade on update cascade,
  user_id    uuid references public.profiles(id) on delete set null on update cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_task_id_idx on public.task_comments (task_id);
create index task_comments_created_at_idx on public.task_comments (created_at desc);

create trigger set_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade on update cascade,
  from_user_id uuid references public.profiles(id) on delete set null on update cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  reference_id uuid,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_user_id_read_created_at_idx
  on public.notifications (user_id, read, created_at desc);

-- ---------------------------------------------------------------
-- research_queries
-- (property_id i created_by bez FK — tak samo jak w schemacie Prismy)
-- ---------------------------------------------------------------
create table public.research_queries (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid,
  person_name text not null,
  kw_number   text,
  notes       text,
  status      text not null default 'pending',
  results     jsonb,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index research_queries_person_name_idx on public.research_queries (person_name);
create index research_queries_created_at_idx on public.research_queries (created_at desc);

create trigger set_research_queries_updated_at
  before update on public.research_queries
  for each row execute function public.set_updated_at();
