/**
 * Backfill współrzędnych kontaktów — geokoduje kontakty, które mają adres
 * (miasto/ulica), ale nie mają lat/lng (np. wgrane importem z Trello, który
 * nie geokodował). Bez tego nie pojawiają się na mapie.
 *
 * Użycie:
 *   npx tsx scripts/geocode-kontakty.ts            # na sucho: pokazuje, ile jest do zrobienia
 *   npx tsx scripts/geocode-kontakty.ts --commit   # geokoduje i zapisuje
 *   npx tsx scripts/geocode-kontakty.ts --commit --limit 200   # tylko N (można w turach)
 *
 * Geokoder: Nominatim (OpenStreetMap) — limit 1 zapytanie/s, więc pełen
 * backfill kilku tysięcy kontaktów potrwa kilkadziesiąt minut. Można
 * przerwać (Ctrl+C) i dokończyć później — skrypt bierze tylko te bez coords.
 * Wymaga SUPABASE_DB_URL (bezpośredni Postgres, jak inne skrypty).
 */
import 'dotenv/config'
import { Client } from 'pg'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function geocode(ulica: string | null, miasto: string | null, woj: string | null): Promise<{ lat: number; lng: number } | null> {
  const parts = [ulica, miasto, woj, 'Polska'].filter(Boolean)
  if (parts.length < 2) return null
  try {
    const q = encodeURIComponent(parts.join(', '))
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=pl&limit=1`,
      { headers: { 'User-Agent': 'LimonaCRM/1.0 (backfill)', 'Accept-Language': 'pl' }, signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}

async function main() {
  const commit = process.argv.includes('--commit')
  const limit = parseInt(arg('limit') ?? '0', 10) || 0
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) { console.error('Ustaw SUPABASE_DB_URL w env/.env'); process.exit(1) }

  const db = new Client({ connectionString: dbUrl })
  await db.connect()

  // Do zrobienia: brak coords, ale jest miasto albo ulica
  const { rows } = await db.query<{ id: string; ulica: string | null; miasto: string | null; wojewodztwo: string | null }>(
    `SELECT id, ulica, miasto, wojewodztwo FROM kontakty
     WHERE (lat IS NULL OR lng IS NULL) AND (coalesce(miasto,'') <> '' OR coalesce(ulica,'') <> '')
     ORDER BY created_at DESC` + (limit ? ` LIMIT ${limit}` : ''),
  )

  console.log(`Kontaktów do geokodowania: ${rows.length}${commit ? '' : ' (na sucho — nic nie zapisuję)'}`)
  if (!commit) {
    console.log('Uruchom z --commit, żeby geokodować i zapisać. Szac. czas: ~' + Math.ceil(rows.length / 60) + ' min (limit 1 zapytanie/s).')
    await db.end()
    return
  }

  let ok = 0, fail = 0
  for (let i = 0; i < rows.length; i++) {
    const k = rows[i]
    const coords = await geocode(k.ulica, k.miasto, k.wojewodztwo)
    if (coords) {
      await db.query('UPDATE kontakty SET lat = $1, lng = $2 WHERE id = $3', [coords.lat, coords.lng, k.id])
      ok++
    } else {
      fail++
    }
    if ((i + 1) % 50 === 0) console.log(`... ${i + 1}/${rows.length} (znalezione: ${ok}, bez wyniku: ${fail})`)
    await sleep(1100) // Nominatim: max 1 zapytanie/s
  }

  await db.end()
  console.log(`\nGotowe. Zgeokodowano: ${ok} | bez trafienia adresu: ${fail}`)
  if (fail) console.log('Kontakty bez trafienia mają zbyt ogólny/niepełny adres — uzupełnij ręcznie lub zbiorczo (miasto/województwo) i uruchom ponownie.')
}

main().catch(e => { console.error(e); process.exit(1) })
