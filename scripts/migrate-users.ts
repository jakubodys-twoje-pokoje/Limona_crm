/**
 * Migracja użytkowników: stara baza (NextAuth, profiles.password z bcrypt)
 * → Supabase Auth (auth.users + auth.identities).
 *
 * Wstawia userów SQL-em bezpośrednio do schematu auth, dzięki czemu:
 *  - zachowujemy oryginalne UUID (profiles.id = auth.users.id, zero remapowania FK),
 *  - zachowujemy hashe bcrypt (GoTrue weryfikuje $2a$/$2b$ natywnie) — ludzie
 *    logują się starymi hasłami.
 * To standardowa ścieżka migracji z NextAuth; admin API GoTrue przyjmuje
 * password_hash, ale nie pozwala nadać własnego id — stąd SQL.
 *
 * Trigger on_auth_user_created (0002_auth.sql) sam tworzy wiersze w public.profiles;
 * na końcu uzupełniamy avatar_url i oryginalne created_at/updated_at.
 *
 * Uruchomienie (po zaaplikowaniu migracji na projekcie Supabase):
 *   OLD_DATABASE_URL=postgres://...stara baza...
 *   SUPABASE_DB_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres
 *   npx tsx scripts/migrate-users.ts
 *
 * PRZED STARTEM zrób backup starej bazy: pg_dump "$OLD_DATABASE_URL" > backup.sql
 */
import 'dotenv/config'
import { Client } from 'pg'

interface OldProfile {
  id: string
  email: string
  password: string
  full_name: string
  avatar_url: string | null
  role: string
  created_at: Date
  updated_at: Date
}

async function main() {
  const oldUrl = process.env.OLD_DATABASE_URL
  const newUrl = process.env.SUPABASE_DB_URL
  if (!oldUrl || !newUrl) {
    console.error('Ustaw OLD_DATABASE_URL i SUPABASE_DB_URL w środowisku/.env')
    process.exit(1)
  }

  const oldDb = new Client({ connectionString: oldUrl })
  const newDb = new Client({ connectionString: newUrl })
  await oldDb.connect()
  await newDb.connect()

  const { rows: profiles } = await oldDb.query<OldProfile>(
    'SELECT id, email, password, full_name, avatar_url, role, created_at, updated_at FROM profiles ORDER BY created_at'
  )
  console.log(`Znaleziono ${profiles.length} użytkowników w starej bazie`)

  let imported = 0
  let skipped = 0

  for (const p of profiles) {
    if (!/^\$2[aby]\$/.test(p.password)) {
      console.error(`POMIJAM ${p.email}: hash nie wygląda na bcrypt (${p.password.slice(0, 4)}...) — wymaga ręcznej decyzji`)
      skipped++
      continue
    }

    try {
      await newDb.query('BEGIN')
      // GoTrue wymaga pustych stringów (nie NULL) w kolumnach tokenów.
      await newDb.query(
        `INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at, confirmation_token, recovery_token,
           email_change, email_change_token_new, email_change_token_current
         ) VALUES (
           '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
           $2, $3, now(),
           '{"provider":"email","providers":["email"]}'::jsonb,
           jsonb_build_object('full_name', $4::text, 'role', $5::text, 'avatar_url', $6::text),
           $7, $8, '', '', '', '', ''
         )
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.email, p.password, p.full_name, p.role, p.avatar_url, p.created_at, p.updated_at]
      )
      await newDb.query(
        `INSERT INTO auth.identities (
           id, user_id, identity_data, provider, provider_id,
           last_sign_in_at, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1,
           jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
           'email', $1::text, now(), $3, $4
         )
         ON CONFLICT (provider_id, provider) DO NOTHING`,
        [p.id, p.email, p.created_at, p.updated_at]
      )
      // Trigger utworzył profil — uzupełniamy pola, których nie zna.
      await newDb.query(
        'UPDATE public.profiles SET avatar_url = $2, created_at = $3, updated_at = $4 WHERE id = $1',
        [p.id, p.avatar_url, p.created_at, p.updated_at]
      )
      await newDb.query('COMMIT')
      imported++
      console.log(`OK: ${p.email} (${p.role})`)
    } catch (e) {
      await newDb.query('ROLLBACK')
      console.error(`BŁĄD przy ${p.email}:`, e)
      skipped++
    }
  }

  const { rows: [authCount] } = await newDb.query('SELECT count(*)::int AS n FROM auth.users')
  const { rows: [profCount] } = await newDb.query('SELECT count(*)::int AS n FROM public.profiles')
  console.log('\n--- Podsumowanie ---')
  console.log(`Zaimportowano: ${imported}, pominięto: ${skipped}`)
  console.log(`auth.users: ${authCount.n}, public.profiles: ${profCount.n}, stara baza: ${profiles.length}`)
  if (authCount.n !== profiles.length || profCount.n !== profiles.length) {
    console.error('UWAGA: liczności się nie zgadzają — sprawdź logi powyżej!')
    process.exitCode = 1
  }

  await oldDb.end()
  await newDb.end()
}

main()
