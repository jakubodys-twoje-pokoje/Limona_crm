# Limona CRM

CRM do zarządzania nieruchomościami: Next.js (App Router) + Supabase (Postgres, Auth, Storage).

## Stack

- **Frontend/API**: Next.js 14, App Router, API routes w `src/app/api/**`
- **Baza + Auth + Storage**: Supabase — klienci w `src/lib/supabase/`, sesja przez `@supabase/ssr` (cookies), RLS włączone na wszystkich tabelach
- **Architektura**: frontend → API routes → Supabase. Hooki w `src/hooks/*` wołają wyłącznie endpointy API; API routes używają klienta serwerowego z sesją użytkownika. Service role (`src/lib/supabase/admin.ts`) tylko do operacji na kontach — nigdy w zapytaniach z sesją usera.

## Setup Supabase

### Lokalnie

Wymaga Dockera i CLI Supabase (jest w devDependencies).

```bash
npm install
npm run db:start          # supabase start — stawia lokalny stack i wypisuje klucze
cp .env.example .env.local
# wpisz NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY z outputu `supabase start`
npm run db:reset          # aplikuje migracje z supabase/migrations/
npm run dev
```

Konta lokalnie tworzysz przez panel admina aplikacji (pierwszego admina przez Supabase Studio:
`http://127.0.0.1:54323` → Authentication → Add user, potem w tabeli `profiles` ustaw `role = 'admin'`).

### Produkcja

1. Utwórz projekt na [supabase.com](https://supabase.com), w ustawieniach Auth **wyłącz publiczny signup** (konta tworzy wyłącznie admin przez aplikację).
2. `npx supabase link --project-ref <ref>`, potem `npm run db:push` (aplikuje `supabase/migrations/`).
3. Uzupełnij `.env` (patrz `.env.example`) w środowisku hostingu.

### Migracja ze starej bazy (Prisma + NextAuth) — jednorazowo

Hasła były bcryptem, więc użytkownicy logują się starymi hasłami; UUID kont są zachowane.

```bash
pg_dump "$OLD_DATABASE_URL" > backup-$(date +%F).sql   # backup!
# w .env: OLD_DATABASE_URL + SUPABASE_DB_URL (bezpośredni Postgres projektu)
npm run migrate:users   # auth.users + auth.identities + profiles (zachowuje id i hashe)
npm run migrate:data    # pozostałe tabele w kolejności FK + weryfikacja liczności
```

Oba skrypty na końcu porównują liczność rekordów per tabela ze starą bazą i kończą się błędem przy rozjeździe.

## Zmiany schematu

Każda zmiana = nowa migracja SQL w `supabase/migrations/` (`npx supabase migration new <nazwa>`).
Typy bazowe generuj przez `npm run db:types` (do `src/types/supabase.ts` — nie edytuj ręcznie);
uniony i interfejsy aplikacyjne utrzymywane są w `src/types/database.ts`.

## Komendy

```bash
npm run dev          # dev server
npm run build        # build produkcyjny
npm run lint         # eslint
npm run db:start     # lokalny stack Supabase
npm run db:reset     # przebudowa lokalnej bazy z migracji
npm run db:migrate   # aplikuje nowe migracje (supabase migration up)
npm run db:push      # aplikuje migracje na zlinkowany projekt (prod)
npm run db:types     # generuje typy TS ze schematu lokalnej bazy
```
