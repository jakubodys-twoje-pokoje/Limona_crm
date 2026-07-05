/**
 * Migracja danych: stara baza (Prisma) → Supabase (Postgres).
 * Kopiuje wszystkie tabele w kolejności zgodnej z FK i na końcu
 * porównuje liczność rekordów per tabela.
 *
 * WYMAGANA KOLEJNOŚĆ całej migracji:
 *   1. migracje SQL na projekcie Supabase (supabase db push / migration up)
 *   2. npx tsx scripts/migrate-users.ts   (auth.users + profiles)
 *   3. npx tsx scripts/migrate-data.ts    (ten skrypt — reszta tabel)
 *
 * Łączy się bezpośrednio po Postgresie (SUPABASE_DB_URL, rola postgres),
 * więc RLS nie blokuje zapisu. Nigdy nie używaj tego połączenia w aplikacji.
 *
 * PRZED STARTEM zrób backup: pg_dump "$OLD_DATABASE_URL" > backup.sql
 */
import 'dotenv/config'
import { Client } from 'pg'

// Kolejność zgodna z FK (profiles migruje migrate-users.ts).
// documents: kolumny wg schematu — pliki nie istnieją (feature bez UI).
const TABLES: { name: string; columns: string[] }[] = [
  {
    name: 'properties',
    columns: [
      'id', 'location', 'trello_link', 'phone', 'contact_type', 'property_type',
      'area_sqm', 'value_per_sqm', 'total_debt', 'debt_type',
      'creditor1_amount', 'creditor2_amount', 'creditor3_amount',
      'owner_coefficient', 'commission_pct', 'notary_fee', 'manual_offer',
      'status', 'decision', 'notes', 'created_by', 'assigned_to',
      'created_at', 'updated_at',
    ],
  },
  {
    name: 'tasks',
    columns: [
      'id', 'property_id', 'title', 'description', 'status', 'priority',
      'due_date', 'assigned_to', 'created_by', 'completed_at',
      'created_at', 'updated_at',
    ],
  },
  {
    name: 'activity_log',
    columns: ['id', 'property_id', 'task_id', 'user_id', 'action', 'details', 'created_at'],
  },
  {
    name: 'documents',
    columns: ['id', 'property_id', 'name', 'file_url', 'file_type', 'uploaded_by', 'created_at'],
  },
  {
    name: 'wall_messages',
    columns: ['id', 'user_id', 'content', 'pinned', 'created_at'],
  },
  {
    name: 'wall_reads',
    columns: ['user_id', 'message_id', 'read_at'],
  },
  {
    name: 'team_visibility',
    columns: ['id', 'manager_id', 'member_id', 'created_by', 'created_at'],
  },
  {
    name: 'task_comments',
    columns: ['id', 'task_id', 'user_id', 'content', 'created_at', 'updated_at'],
  },
  {
    name: 'notifications',
    columns: [
      'id', 'user_id', 'from_user_id', 'type', 'title', 'body', 'link',
      'reference_id', 'read', 'created_at',
    ],
  },
  {
    name: 'research_queries',
    columns: [
      'id', 'property_id', 'person_name', 'kw_number', 'notes', 'status',
      'results', 'created_by', 'created_at', 'updated_at',
    ],
  },
]

const BATCH = 500

async function copyTable(oldDb: Client, newDb: Client, name: string, columns: string[]) {
  const cols = columns.join(', ')
  const { rows } = await oldDb.query(`SELECT ${cols} FROM ${name}`)
  if (rows.length === 0) {
    console.log(`${name}: pusto, pomijam`)
    return
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const placeholders = batch
      .map((row, r) => {
        const ph = columns.map((c, cIdx) => {
          values.push(row[c])
          return `$${r * columns.length + cIdx + 1}`
        })
        return `(${ph.join(', ')})`
      })
      .join(', ')
    await newDb.query(
      `INSERT INTO ${name} (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    )
  }
  console.log(`${name}: skopiowano ${rows.length}`)
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

  for (const t of TABLES) {
    await copyTable(oldDb, newDb, t.name, t.columns)
  }

  // Weryfikacja liczności per tabela (w tym profiles z migrate-users)
  console.log('\n--- Weryfikacja liczności ---')
  let mismatch = false
  for (const name of ['profiles', ...TABLES.map(t => t.name)]) {
    const { rows: [o] } = await oldDb.query(`SELECT count(*)::int AS n FROM ${name}`)
    const { rows: [n] } = await newDb.query(`SELECT count(*)::int AS n FROM ${name}`)
    const ok = o.n === n.n
    if (!ok) mismatch = true
    console.log(`${ok ? 'OK ' : 'ZLE'} ${name}: stara=${o.n} nowa=${n.n}`)
  }
  if (mismatch) {
    console.error('\nUWAGA: różnice w licznościach — sprawdź logi!')
    process.exitCode = 1
  } else {
    console.log('\nWszystkie liczności zgodne.')
  }

  await oldDb.end()
  await newDb.end()
}

main()
