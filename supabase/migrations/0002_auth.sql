-- =============================================================
-- 0002_auth — przepięcie profiles na Supabase Auth
--  * profiles.id = auth.users.id (FK, bez własnego defaultu)
--  * trigger on_auth_user_created tworzący profil
--  * usunięcie kolumny password (hasła żyją w auth.users;
--    import istniejących userów robi scripts/migrate-users.ts
--    PRZED uruchomieniem aplikacji na nowej bazie — patrz README)
-- =============================================================

alter table public.profiles
  alter column id drop default;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles
  drop column password;

-- Profil tworzony automatycznie przy powstaniu konta w auth.users.
-- full_name / role / avatar_url przekazywane w raw_user_meta_data
-- (ustawia je endpoint admin/create-user oraz skrypt importu).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zmiana emaila w auth.users ma być widoczna w profiles (API trzyma
-- email w obu miejscach — auth jest źródłem prawdy do logowania).
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_updated();
