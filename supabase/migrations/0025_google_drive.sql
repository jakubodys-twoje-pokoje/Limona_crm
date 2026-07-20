-- =============================================================
-- 0025 — integracja Google Drive
--  * drive_folder_id na leads/properties/kontakty — ID folderu
--    danego rekordu w Drive (tworzony leniwie przy pierwszym
--    otwarciu zakładki Dokumenty, żeby nie palić limitów API)
--  * drive_folders — cache ID folderów-kategorii (Leady,
--    Nieruchomości, Spółdzielnie, …), żeby nie szukać ich
--    w Drive przy każdym wejściu
-- =============================================================

alter table public.leads      add column if not exists drive_folder_id text;
alter table public.properties add column if not exists drive_folder_id text;
alter table public.kontakty   add column if not exists drive_folder_id text;

create table if not exists public.drive_folders (
  key        text primary key,
  folder_id  text not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.drive_folders to authenticated;
grant all on public.drive_folders to service_role;

alter table public.drive_folders enable row level security;
drop policy if exists "drive_folders_select" on public.drive_folders;
create policy "drive_folders_select" on public.drive_folders for select to authenticated using (true);
drop policy if exists "drive_folders_insert" on public.drive_folders;
create policy "drive_folders_insert" on public.drive_folders for insert to authenticated with check (true);
drop policy if exists "drive_folders_update" on public.drive_folders;
create policy "drive_folders_update" on public.drive_folders for update to authenticated using (true) with check (true);
