-- =============================================================
-- 0026 — app_settings: sekrety/ustawienia serwerowe aplikacji
--  (m.in. refresh token Google OAuth dla integracji Drive).
--  Dostęp WYŁĄCZNIE przez service role — RLS włączone bez żadnych
--  polityk, więc zalogowani użytkownicy nie odczytają nic.
-- =============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;
-- celowo brak polityk: authenticated nie ma dostępu w ogóle
