/**
 * Import tablicy Trello (eksport JSON) → Limona CRM.
 *
 * Użycie (zawsze zacznij od przebiegu NA SUCHO — bez --commit nic nie zapisuje):
 *   npx tsx scripts/import-trello.ts --board trello-export.json --config scripts/trello-import.config.json
 *   npx tsx scripts/import-trello.ts --board ... --config ... --commit
 *
 * Podgląd samych list (do wypełnienia konfigu):
 *   npx tsx scripts/import-trello.ts --board trello-export.json --report-lists
 *
 * DLACZEGO KLUCZ API: eksport JSON z Trello obcina akcje do ostatnich 1000
 * (na całą tablicę!), więc większość komentarzy — a u nas to główne dane —
 * w ogóle nie ma w pliku. Z kluczem API skrypt dociąga PEŁNE komentarze
 * każdej karty oraz pobiera załączniki-pliki (upload do Supabase Storage,
 * bucket `trello-import` — migracja 0021). Klucz i token:
 *   https://trello.com/power-ups/admin  → New → API key → wygeneruj token
 *   TRELLO_KEY=...  TRELLO_TOKEN=...   (env/.env albo --key/--token)
 * Bez klucza import też działa — komentarze tylko z eksportu (ucięte),
 * załączniki-pliki jako linki do Trello (wymagają zalogowania do Trello).
 *
 * Mapowanie list → encje CRM: scripts/trello-import.config.example.json
 * (reguły po fragmencie nazwy, w kolejności; agent wykrywany z nazwy listy
 * albo z sekcji tablicy — listy "SUKCES!"/"ODRZUCONE" dziedziczą agenta
 * z poprzedzającej sekcji).
 *
 * AI (opcjonalnie, mocno zalecane przy zabałaganionych kartach): z kluczem
 * GEMINI_API_KEY (env albo --gemini-key) model czyta opis + komentarze każdej
 * karty i układa dane w pola CRM (adres, nr KW, metraż, zadłużenie, dłużnik,
 * czynsz, telefon...). Regexy zostają jako fallback — awaria AI nie psuje
 * importu. Jakość sprawdzisz przed importem na próbce:
 *   npx tsx scripts/import-trello.ts --board ... --config ... --ai-sample 10
 * Odpowiedzi cache'ują się per karta (scripts/.trello-ai-cache.json), więc
 * ponowny przebieg nie płaci drugi raz. Model: GEMINI_MODEL (domyślnie
 * gemini-2.5-flash). Klucz: https://aistudio.google.com/apikey
 *
 * Idempotencja: każdy rekord dostaje znacznik [trello:<idKarty>] (leady:
 * meta.trello_card_id). Ponowne uruchomienie pomija już zaimportowane.
 *
 * Wymagane env: SUPABASE_DB_URL (bezpośredni Postgres, jak inne skrypty);
 * do pobierania plików dodatkowo NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'fs'
import { Client } from 'pg'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Typy eksportu Trello (używane fragmenty) ────────────────────────────────

interface TrelloMember { id: string; username: string; fullName: string }
interface TrelloList { id: string; name: string; closed: boolean; pos: number }
interface TrelloLabel { name: string }
interface TrelloAttachment {
  id: string; name: string; url: string; bytes: number | null
  isUpload: boolean; mimeType: string | null; fileName: string | null; date: string
}
interface TrelloCheckItem { name: string; state: 'complete' | 'incomplete' }
interface TrelloChecklist { id: string; idCard: string; name: string; checkItems: TrelloCheckItem[] }
interface TrelloBadges { comments?: number; attachments?: number; checkItems?: number }
interface TrelloCard {
  id: string; name: string; desc: string; closed: boolean; idList: string
  idMembers: string[]; due: string | null; dueComplete: boolean
  labels: TrelloLabel[]; attachments?: TrelloAttachment[]
  badges?: TrelloBadges; dateLastActivity: string
  address?: string | null; locationName?: string | null
  coordinates?: { latitude: number; longitude: number } | string | null
}
interface TrelloAction {
  id: string; type: string; date: string
  data: { card?: { id: string }; text?: string }
  memberCreator?: { id: string; username: string; fullName: string }
}
interface TrelloBoard {
  name: string; lists: TrelloList[]; cards: TrelloCard[]
  checklists: TrelloChecklist[]; members: TrelloMember[]; actions: TrelloAction[]
}

// ─── Typy konfiguracji ───────────────────────────────────────────────────────

interface ListRule {
  match: string
  target: 'property' | 'lead' | 'kontakt' | 'skip'
  status_dluznika?: string
  temperature?: 'hot' | 'warm' | 'cold'
  status?: string
  typ?: string
}

interface ImportConfig {
  options?: {
    includeArchivedCards?: boolean
    skipHeaderCards?: boolean
    downloadAttachments?: boolean
    defaultAssigneeEmail?: string | null
    leadSource?: string
  }
  agents?: Record<string, string>      // alias sekcji/prefiksu listy (małe litery) → email w CRM
  members?: Record<string, string>     // username Trello → email w CRM
  listRules: ListRule[]
  labels?: Record<string, { lead_temperature?: 'hot' | 'warm' | 'cold' }>
}

// ─── Argumenty / pomocnicze ──────────────────────────────────────────────────

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}

const PHONE_RE = /(?:\+?48[\s-]?)?(?:\d[\s-]?){9}/
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/
const POSTAL_RE = /\b\d{2}-\d{3}\b/

const extractPhone = (t: string) => t.match(PHONE_RE)?.[0].replace(/[\s-]/g, '').replace(/^\+?48/, '') ?? null
const extractEmail = (t: string) => t.match(EMAIL_RE)?.[0] ?? null

/** "Warszawa, ul. Płocka 17/112" → { adres, kod, miasto } (best effort — u nas miasto bywa pierwsze) */
function parseAddress(name: string): { adres: string; kod: string | null; miasto: string | null } {
  const clean = name.trim()
  const kod = clean.match(POSTAL_RE)?.[0] ?? null
  const parts = clean.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    // Człon bez cyfr traktujemy jako miasto (obojętnie czy pierwszy, czy ostatni)
    const cityIdx = parts.findIndex(p => !/\d/.test(p.replace(POSTAL_RE, '')))
    if (cityIdx !== -1) {
      const miasto = parts[cityIdx].replace(POSTAL_RE, '').trim() || null
      const rest = parts.filter((_, i) => i !== cityIdx).join(', ')
      if (rest) return { adres: rest, kod, miasto }
    }
    return { adres: parts.slice(0, -1).join(', '), kod, miasto: parts[parts.length - 1].replace(POSTAL_RE, '').trim() || null }
  }
  return { adres: clean, kod, miasto: null }
}

const marker = (cardId: string) => `[trello:${cardId}]`
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function sanitizeFileName(name: string): string {
  return decodeURIComponent(name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'plik'
}

// ─── Trello API (komentarze + pobieranie plików) ─────────────────────────────

const trelloKey = arg('key') || process.env.TRELLO_KEY || null
const trelloToken = arg('token') || process.env.TRELLO_TOKEN || null
const hasApi = !!(trelloKey && trelloToken)

async function apiGet(path: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.trello.com/1${path}${sep}key=${trelloKey}&token=${trelloToken}`)
  if (res.status === 429) { await sleep(3000); return apiGet(path) } // rate limit — odczekaj i ponów
  if (!res.ok) throw new Error(`Trello API ${res.status}: ${path}`)
  await sleep(130) // ~7 req/s — bezpiecznie poniżej limitu 100/10s
  return res.json()
}

/** Pełne komentarze karty — eksport JSON obcina akcje, API nie */
async function fetchAllComments(cardId: string): Promise<TrelloAction[]> {
  const out: TrelloAction[] = []
  let before: string | null = null
  for (;;) {
    const page = await apiGet(`/cards/${cardId}/actions?filter=commentCard&limit=1000${before ? `&before=${before}` : ''}`) as TrelloAction[]
    out.push(...page)
    if (page.length < 1000) break
    before = page[page.length - 1].id
  }
  return out
}

async function downloadAttachment(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `OAuth oauth_consumer_key="${trelloKey}", oauth_token="${trelloToken}"` },
    })
    if (!res.ok) return null
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    }
  } catch {
    return null
  }
}

// ─── AI (Gemini) — układanie danych z opisów/komentarzy w pola ───────────────
//
// Karty Trello mają kluczowe dane wciśnięte w opisy i komentarze wolnym
// tekstem. Z GEMINI_API_KEY (env albo --gemini-key) model czyta całą treść
// karty i zwraca ustrukturyzowany JSON (adres, KW, metraż, zadłużenie,
// dłużnik, telefon...). Gdy AI nie odpowie / zwróci śmieci — twardy
// fallback na dotychczasowe regexy, import NIGDY się na AI nie wywala.
// Odpowiedzi cache'ują się w scripts/.trello-ai-cache.json (per karta),
// więc ponowny przebieg nie płaci drugi raz za te same karty.

const geminiKey = arg('gemini-key') || process.env.GEMINI_API_KEY || null
const GEMINI_MODEL = arg('gemini-model') || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const AI_CACHE_PATH = 'scripts/.trello-ai-cache.json'

interface AiPropertyFields {
  adres?: string | null; kod_pocztowy?: string | null; miasto?: string | null
  owner_name?: string | null; phone?: string | null; kw_number?: string | null
  area_sqm?: number | null; total_debt?: number | null; czynsz_miesieczny?: number | null
  rok_budowy?: number | null; pietro?: number | null; uklad?: string | null
  wycena_szacunkowa?: number | null
}
interface AiLeadFields {
  phone?: string | null; email?: string | null; location?: string | null
}
interface AiKontaktFields {
  telefon?: string | null; email?: string | null; miasto?: string | null
  ulica?: string | null; wojewodztwo?: string | null
}

const AI_SCHEMAS: Record<string, { properties: Record<string, { type: string; nullable: boolean }> }> = {
  property: {
    properties: {
      adres: { type: 'STRING', nullable: true }, kod_pocztowy: { type: 'STRING', nullable: true },
      miasto: { type: 'STRING', nullable: true }, owner_name: { type: 'STRING', nullable: true },
      phone: { type: 'STRING', nullable: true }, kw_number: { type: 'STRING', nullable: true },
      area_sqm: { type: 'NUMBER', nullable: true }, total_debt: { type: 'NUMBER', nullable: true },
      czynsz_miesieczny: { type: 'NUMBER', nullable: true }, rok_budowy: { type: 'INTEGER', nullable: true },
      pietro: { type: 'INTEGER', nullable: true }, uklad: { type: 'STRING', nullable: true },
      wycena_szacunkowa: { type: 'NUMBER', nullable: true },
    },
  },
  lead: {
    properties: {
      phone: { type: 'STRING', nullable: true }, email: { type: 'STRING', nullable: true },
      location: { type: 'STRING', nullable: true },
    },
  },
  kontakt: {
    properties: {
      telefon: { type: 'STRING', nullable: true }, email: { type: 'STRING', nullable: true },
      miasto: { type: 'STRING', nullable: true }, ulica: { type: 'STRING', nullable: true },
      wojewodztwo: { type: 'STRING', nullable: true },
    },
  },
}

const AI_PROMPTS: Record<string, string> = {
  property: `Jesteś parserem danych CRM firmy skupującej zadłużone nieruchomości w Polsce.
Z treści karty Trello (nazwa + opis + komentarze) wyciągnij dane nieruchomości.
Zasady: adres = ulica z numerem (bez miasta i kodu). kw_number = numer księgi wieczystej (format XX0X/00000000/0).
owner_name = imię i nazwisko dłużnika/właściciela. total_debt = łączne zadłużenie w PLN (sama liczba).
area_sqm = metraż w m2. pietro = piętro (0 = parter). uklad = układ mieszkania (np. "2 pokoje z kuchnią").
wycena_szacunkowa = szacowana wartość nieruchomości w PLN. phone = telefon do właściciela/kontaktu (9 cyfr, bez +48).
Pole, którego nie ma w tekście = null. NIE zgaduj, NIE wymyślaj.`,
  lead: `Jesteś parserem danych CRM nieruchomości. Z treści karty Trello wyciągnij dane kontaktowe leada:
phone (9 cyfr bez +48), email, location (miasto/dzielnica/adres nieruchomości, o której mowa).
Pole, którego nie ma w tekście = null. NIE zgaduj.`,
  kontakt: `Jesteś parserem danych CRM nieruchomości. Karta Trello opisuje instytucję/osobę
(spółdzielnia, zarządca, komornik, pośrednik). Wyciągnij: telefon (9 cyfr bez +48), email,
miasto, ulica (z numerem), wojewodztwo. Pole, którego nie ma w tekście = null. NIE zgaduj.`,
}

let aiCache: Record<string, unknown> = {}
try { aiCache = JSON.parse(readFileSync(AI_CACHE_PATH, 'utf8')) } catch { /* brak cache — ok */ }
let aiCacheDirty = 0
let aiCalls = 0
let aiFailures = 0

function saveAiCache() {
  try { writeFileSync(AI_CACHE_PATH, JSON.stringify(aiCache)) } catch { /* ignore */ }
}

async function aiExtract<T>(target: 'property' | 'lead' | 'kontakt', cardId: string, content: string, retriesLeft = 3): Promise<T | null> {
  if (!geminiKey) return null
  const cacheKey = `${target}:${cardId}`
  if (cacheKey in aiCache) return aiCache[cacheKey] as T | null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${AI_PROMPTS[target]}\n\n--- TREŚĆ KARTY ---\n${content.slice(0, 24000)}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: { type: 'OBJECT', ...AI_SCHEMAS[target] },
            temperature: 0,
          },
        }),
      },
    )
    if (res.status === 429 && retriesLeft > 0) { await sleep(10000); return aiExtract(target, cardId, content, retriesLeft - 1) }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400)
      throw new Error(`Gemini HTTP ${res.status}: ${body}`)
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = text ? JSON.parse(text) as T : null
    aiCalls++
    aiCache[cacheKey] = parsed
    if (++aiCacheDirty % 50 === 0) saveAiCache()
    return parsed
  } catch (e) {
    aiFailures++
    // Pierwsze błędy pokazujemy w całości — inaczej nie wiadomo, CO nie działa
    // (zły klucz? limit? model?). Kolejne już cicho, żeby nie zalać raportu.
    if (aiFailures <= 3) console.warn(`\n⚠ AI błąd (${aiFailures}): ${(e as Error).message}`)
    if (aiFailures === 3) console.warn('  ... kolejne błędy AI wyciszam; import leci dalej na regexach\n')
    return null // fallback na regexy — import idzie dalej
  }
}

/** Liczby z AI bywają stringami/śmieciami — przyjmujemy tylko sensowne wartości */
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// ─── Klasyfikacja list (sekcje per agent) ────────────────────────────────────

interface ClassifiedList { list: TrelloList; rule: ListRule | null; agentEmail: string | null }

function classifyLists(board: TrelloBoard, config: ImportConfig): Map<string, ClassifiedList> {
  const aliases = Object.keys(config.agents ?? {}).map(a => a.toLowerCase())
  const byPos = [...board.lists].sort((a, b) => a.pos - b.pos)
  const out = new Map<string, ClassifiedList>()
  let sectionAgent: string | null = null

  for (const list of byPos) {
    const lname = list.name.toLowerCase().trim()
    // Lista będąca samym imieniem agenta = nagłówek sekcji ("Gosia", "igor", ...)
    const exactAlias = aliases.find(a => lname === a)
    if (exactAlias) sectionAgent = config.agents![exactAlias] ?? null
    // Prefiks z imieniem agenta w nazwie listy wygrywa nad sekcją
    const prefixAlias = aliases.find(a => lname.startsWith(a + ' ') || lname.includes(` ${a} `))
    const agentEmail = prefixAlias ? config.agents![prefixAlias] : sectionAgent

    const rule = config.listRules.find(r => lname.includes(r.match.toLowerCase())) ?? null
    out.set(list.id, { list, rule, agentEmail })
  }
  return out
}

/** Karta-nagłówek sekcji ("W PROWADZENIU BIURA" itp.) — nic nie wnosi, pomijamy */
function isHeaderCard(card: TrelloCard): boolean {
  const b = card.badges ?? {}
  return !card.desc?.trim() && !(b.comments || 0) && !(b.attachments || 0) && !(b.checkItems || 0) && !card.due
}

// ─── Główny przebieg ─────────────────────────────────────────────────────────

async function main() {
  const boardPath = arg('board')
  const commit = process.argv.includes('--commit')
  const reportListsOnly = process.argv.includes('--report-lists')
  // Na sucho AI odpala się tylko dla próbki N kart (--ai-sample N) — do
  // oceny jakości ekstrakcji przed właściwym importem. Na commicie: wszystkie.
  let aiSampleLeft = Math.max(0, parseInt(arg('ai-sample') ?? '0', 10) || 0)

  if (!boardPath) {
    console.error('Użycie: npx tsx scripts/import-trello.ts --board <eksport.json> --config <config.json> [--commit] [--key X --token Y] [--gemini-key X] [--ai-sample N]')
    process.exit(1)
  }
  const board: TrelloBoard = JSON.parse(readFileSync(boardPath, 'utf8'))

  // Tryb podglądu list — pomaga wypełnić konfig
  if (reportListsOnly) {
    const counts = new Map<string, number>()
    for (const c of board.cards) counts.set(c.idList, (counts.get(c.idList) ?? 0) + 1)
    console.log(`Tablica: "${board.name}" — ${board.lists.length} list, ${board.cards.length} kart\n`)
    for (const l of [...board.lists].sort((a, b) => a.pos - b.pos)) {
      console.log(`${l.closed ? '[ARCH] ' : ''}${l.name}  (kart: ${counts.get(l.id) ?? 0})`)
    }
    console.log('\nUżytkownicy Trello (do sekcji members w konfigu):')
    for (const m of board.members) console.log(`  ${m.username} → ${m.fullName}`)
    return
  }

  const configPath = arg('config')
  if (!configPath) { console.error('Brak --config <plik.json>'); process.exit(1) }
  const config: ImportConfig = JSON.parse(readFileSync(configPath, 'utf8'))

  const includeArchived = config.options?.includeArchivedCards ?? false
  const skipHeaders = config.options?.skipHeaderCards ?? true
  const wantDownloads = (config.options?.downloadAttachments ?? true) && hasApi

  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl && commit) { console.error('Ustaw SUPABASE_DB_URL w env/.env'); process.exit(1) }

  let storage: SupabaseClient | null = null
  if (commit && wantDownloads) {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supaUrl || !serviceKey) {
      console.error('Do pobierania załączników ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }
    storage = createSupabaseClient(supaUrl, serviceKey, { auth: { persistSession: false } })
  }

  if (!hasApi) {
    console.warn('⚠ Brak TRELLO_KEY/TRELLO_TOKEN — komentarze tylko z eksportu (Trello obcina je do 1000 akcji!),')
    console.warn('  a załączniki-pliki zostaną jako linki do trello.com (wymagają zalogowania).')
    console.warn('  Klucz: https://trello.com/power-ups/admin\n')
  }
  if (geminiKey) {
    console.log(`🤖 AI włączone (${GEMINI_MODEL}) — dane z opisów/komentarzy będą układane w pola${commit ? '' : aiSampleLeft ? ` (próbka ${aiSampleLeft} kart)` : ' (na sucho AI śpi — użyj --ai-sample N, żeby zobaczyć próbkę)'}`)
  } else {
    console.log('ℹ Bez GEMINI_API_KEY dane z opisów wyciągają tylko regexy (telefon/email/kod pocztowy).')
  }

  const db = dbUrl ? new Client({ connectionString: dbUrl }) : null
  if (db) await db.connect()

  // Mapowanie userów: email → profiles.id
  const emailToProfile = new Map<string, string>()
  if (db) {
    const { rows } = await db.query<{ id: string; email: string }>('SELECT id, email FROM profiles')
    for (const r of rows) emailToProfile.set(r.email.toLowerCase(), r.id)
  }
  const profileByEmail = (email: string | null | undefined) =>
    email ? emailToProfile.get(email.toLowerCase()) ?? null : null

  const trelloMemberToProfile = new Map<string, string>()
  const unmappedMembers = new Set<string>()
  for (const m of board.members ?? []) {
    const pid = profileByEmail(config.members?.[m.username])
    if (pid) trelloMemberToProfile.set(m.id, pid)
    else unmappedMembers.add(`${m.username} (${m.fullName})`)
  }
  const defaultAssignee = profileByEmail(config.options?.defaultAssigneeEmail)

  // Indeksy
  const classified = classifyLists(board, config)
  const checklistsByCard = new Map<string, TrelloChecklist[]>()
  for (const cl of board.checklists ?? []) {
    if (!checklistsByCard.has(cl.idCard)) checklistsByCard.set(cl.idCard, [])
    checklistsByCard.get(cl.idCard)!.push(cl)
  }
  const exportCommentsByCard = new Map<string, TrelloAction[]>()
  for (const a of board.actions ?? []) {
    if (a.type === 'commentCard' && a.data.card?.id && a.data.text) {
      if (!exportCommentsByCard.has(a.data.card.id)) exportCommentsByCard.set(a.data.card.id, [])
      exportCommentsByCard.get(a.data.card.id)!.push(a)
    }
  }

  // Idempotencja — znaczniki już w bazie
  const importedCardIds = new Set<string>()
  if (db) {
    const markerRe = /\[trello:([a-f0-9]+)\]/g
    const { rows: p } = await db.query<{ notes: string }>(`SELECT notes FROM properties WHERE notes LIKE '%[trello:%'`)
    const { rows: k } = await db.query<{ opis: string }>(`SELECT opis FROM kontakty WHERE opis LIKE '%[trello:%'`)
    for (const t of [...p.map(r => r.notes), ...k.map(r => r.opis)]) {
      for (const m of t?.matchAll(markerRe) ?? []) importedCardIds.add(m[1])
    }
    const { rows: l } = await db.query<{ meta: { trello_card_id?: string } }>(`SELECT meta FROM leads WHERE meta ? 'trello_card_id'`)
    for (const r of l) if (r.meta.trello_card_id) importedCardIds.add(r.meta.trello_card_id)
  }

  const stats = {
    properties: 0, leads: 0, kontakty: 0, tasks: 0, comments: 0,
    documents: 0, filesDownloaded: 0, filesFailed: 0, photos: 0,
    skippedCards: 0, headerCards: 0, alreadyImported: 0,
  }
  const perList = new Map<string, { target: string; count: number }>()
  const skippedLists = new Set<string>()

  // Komentarze: API (pełne) albo eksport (ucięte). Na sucho nie odpytujemy
  // API — do raportu wystarczy licznik z badges (dokładny).
  async function commentsFor(card: TrelloCard): Promise<TrelloAction[]> {
    const badgeCount = card.badges?.comments ?? 0
    if (badgeCount === 0) return []
    if (hasApi && commit) {
      try { return (await fetchAllComments(card.id)).sort((a, b) => a.date.localeCompare(b.date)) }
      catch (e) { console.warn(`  ⚠ komentarze API dla "${card.name.slice(0, 40)}": ${(e as Error).message}`) }
    }
    return (exportCommentsByCard.get(card.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Załącznik-plik → Supabase Storage → publiczny URL (albo null, gdy się nie uda)
  async function storeAttachment(card: TrelloCard, att: TrelloAttachment): Promise<string | null> {
    if (!storage || !att.isUpload) return null
    if ((att.bytes ?? 0) > 50 * 1024 * 1024) return null // >50MB — zostaw jako link
    const dl = await downloadAttachment(att.url)
    if (!dl) { stats.filesFailed++; return null }
    const path = `${card.id}/${att.id}-${sanitizeFileName(att.fileName || att.name)}`
    const { error } = await storage.storage.from('trello-import').upload(path, dl.bytes, { contentType: dl.contentType, upsert: true })
    if (error) { stats.filesFailed++; return null }
    stats.filesDownloaded++
    const { data } = storage.storage.from('trello-import').getPublicUrl(path)
    return data.publicUrl
  }

  const total = board.cards.length
  let processed = 0

  for (const card of board.cards) {
    processed++
    if (processed % 250 === 0) console.log(`... ${processed}/${total} kart`)

    if (card.closed && !includeArchived) { stats.skippedCards++; continue }
    const cls = classified.get(card.idList)
    if (!cls || !cls.rule || cls.rule.target === 'skip') {
      if (cls && !cls.rule) skippedLists.add(cls.list.name)
      stats.skippedCards++
      continue
    }
    if (skipHeaders && isHeaderCard(card)) { stats.headerCards++; continue }
    if (importedCardIds.has(card.id)) { stats.alreadyImported++; continue }

    const rule = cls.rule
    const assigneeId =
      card.idMembers.map(id => trelloMemberToProfile.get(id)).find(Boolean)
      ?? profileByEmail(cls.agentEmail)
      ?? defaultAssignee

    const comments = await commentsFor(card)
    // Na sucho raportujemy licznik z badges (pełny), nie z uciętego eksportu
    const commentCount = commit ? comments.length : (card.badges?.comments ?? 0)
    const text = `${card.name}\n${card.desc}\n${comments.map(c => c.data.text).join('\n')}`
    const plKey = `${cls.list.name} → ${rule.target}`
    perList.set(plKey, { target: rule.target, count: (perList.get(plKey)?.count ?? 0) + 1 })

    // Współrzędne z power-upa lokalizacji (jeśli są)
    let lat: number | null = null, lng: number | null = null
    if (card.coordinates && typeof card.coordinates === 'object') {
      lat = card.coordinates.latitude; lng = card.coordinates.longitude
    }

    if (rule.target === 'property') {
      // AI układa dane z opisu/komentarzy w pola; regexy jako fallback
      const wantAiProperty = !!geminiKey && (commit || aiSampleLeft > 0)
      if (!commit && wantAiProperty) aiSampleLeft--
      const ai = wantAiProperty ? await aiExtract<AiPropertyFields>('property', card.id, text) : null
      if (!commit && ai) console.log(`\n🤖 AI [property] "${card.name.slice(0, 60)}":`, JSON.stringify(ai, null, 1))
      const parsed = parseAddress(card.address || card.name)
      const adres = str(ai?.adres) ?? parsed.adres
      const kod = str(ai?.kod_pocztowy) ?? parsed.kod
      const miasto = str(ai?.miasto) ?? parsed.miasto
      const checklist: Record<string, unknown> = {}
      for (const cl of checklistsByCard.get(card.id) ?? []) {
        for (const item of cl.checkItems) {
          checklist[item.name.slice(0, 200)] = {
            checked: item.state === 'complete',
            checked_by: null,
            checked_by_name: item.state === 'complete' ? 'Trello (import)' : null,
            checked_at: item.state === 'complete' ? card.dateLastActivity : null,
          }
        }
      }
      const notes = [card.desc?.trim(), marker(card.id)].filter(Boolean).join('\n\n')
      stats.properties++
      stats.comments += commentCount
      if (commit && db) {
        const { rows: [prop] } = await db.query<{ id: string }>(
          `INSERT INTO properties (
             adres, kod_pocztowy, miasto, phone, status_dluznika, notes, checklist,
             assigned_to, created_by, lat, lng,
             owner_name, kw_number, area_sqm, total_debt, czynsz_miesieczny,
             rok_budowy, pietro, uklad, wycena_szacunkowa)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING id`,
          [
            adres.slice(0, 300), kod, miasto,
            str(ai?.phone) ?? extractPhone(text),
            rule.status_dluznika ?? 'brak', notes, JSON.stringify(checklist), assigneeId, lat, lng,
            str(ai?.owner_name), str(ai?.kw_number), num(ai?.area_sqm), num(ai?.total_debt) ?? 0,
            num(ai?.czynsz_miesieczny), num(ai?.rok_budowy), ai?.pietro ?? null,
            str(ai?.uklad), num(ai?.wycena_szacunkowa),
          ],
        )
        for (const c of comments) {
          const authorId = c.memberCreator ? trelloMemberToProfile.get(c.memberCreator.id) ?? null : null
          const content = authorId ? c.data.text! : `[Trello — ${c.memberCreator?.fullName ?? '?'}]\n${c.data.text}`
          await db.query(
            `INSERT INTO property_comments (property_id, user_id, content, created_at) VALUES ($1,$2,$3,$4)`,
            [prop.id, authorId, content, c.date],
          )
        }
        for (const att of card.attachments ?? []) {
          const storedUrl = await storeAttachment(card, att)
          const url = storedUrl ?? att.url
          if (!url?.startsWith('http')) continue
          await db.query(
            `INSERT INTO documents (property_id, name, file_url, file_type) VALUES ($1,$2,$3,$4)`,
            [prop.id, (att.name || 'Załącznik z Trello').slice(0, 200), url, att.mimeType],
          )
          stats.documents++
        }
        if (card.due && !card.dueComplete) {
          await db.query(
            `INSERT INTO tasks (property_id, title, status, priority, due_date, assigned_to)
             VALUES ($1,$2,'todo','medium',$3,$4)`,
            [prop.id, `Termin z Trello: ${card.name}`.slice(0, 200), card.due.slice(0, 10), assigneeId],
          )
          stats.tasks++
        }
      } else {
        stats.documents += (card.attachments ?? []).length
        if (card.due && !card.dueComplete) stats.tasks++
      }
    }

    if (rule.target === 'lead') {
      const wantAiLead = !!geminiKey && (commit || aiSampleLeft > 0)
      if (!commit && wantAiLead) aiSampleLeft--
      const ai = wantAiLead ? await aiExtract<AiLeadFields>('lead', card.id, text) : null
      if (!commit && ai) console.log(`\n🤖 AI [lead] "${card.name.slice(0, 60)}":`, JSON.stringify(ai, null, 1))
      let temperature = rule.temperature ?? 'warm'
      for (const label of card.labels ?? []) {
        const lt = config.labels?.[label.name]?.lead_temperature
        if (lt) temperature = lt
      }
      stats.leads++
      stats.comments += commentCount
      if (commit && db) {
        const attLines = (card.attachments ?? []).map(a => `📎 ${a.name}: ${a.url}`).join('\n')
        const notes = [card.desc?.trim(), attLines].filter(Boolean).join('\n\n') || null
        const { rows: [lead] } = await db.query<{ id: string }>(
          `INSERT INTO leads (name, phone, email, location, notes, source, status, temperature, assigned_to, meta, next_contact_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            card.name.slice(0, 200),
            str(ai?.phone) ?? extractPhone(text),
            str(ai?.email) ?? extractEmail(text),
            str(ai?.location) ?? card.locationName ?? card.address ?? null, notes,
            config.options?.leadSource ?? 'Trello',
            rule.status ?? 'new', temperature, assigneeId,
            JSON.stringify({ trello_card_id: card.id, trello_list: cls.list.name, imported_at: new Date().toISOString() }),
            card.due ? card.due.slice(0, 10) : null,
            card.dateLastActivity,
          ],
        )
        for (const c of comments) {
          const authorId = c.memberCreator ? trelloMemberToProfile.get(c.memberCreator.id) ?? null : null
          const content = authorId ? c.data.text! : `[Trello — ${c.memberCreator?.fullName ?? '?'}]\n${c.data.text}`
          await db.query(
            `INSERT INTO lead_comments (lead_id, user_id, content, created_at) VALUES ($1,$2,$3,$4)`,
            [lead.id, authorId, content, c.date],
          )
        }
      }
    }

    if (rule.target === 'kontakt') {
      const wantAiKontakt = !!geminiKey && (commit || aiSampleLeft > 0)
      if (!commit && wantAiKontakt) aiSampleLeft--
      const ai = wantAiKontakt ? await aiExtract<AiKontaktFields>('kontakt', card.id, text) : null
      if (!commit && ai) console.log(`\n🤖 AI [kontakt] "${card.name.slice(0, 60)}":`, JSON.stringify(ai, null, 1))
      stats.kontakty++
      stats.comments += commentCount
      if (commit && db) {
        const linkLines = (card.attachments ?? []).filter(a => !a.isUpload).map(a => `🔗 ${a.name}: ${a.url}`).join('\n')
        const opis = [card.desc?.trim(), linkLines, marker(card.id)].filter(Boolean).join('\n\n')
        const { rows: [kontakt] } = await db.query<{ id: string }>(
          `INSERT INTO kontakty (typ, nazwa, telefon, email, opis, miasto, ulica, wojewodztwo, assigned_to, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
          [
            rule.typ ?? 'klient', card.name.slice(0, 200),
            str(ai?.telefon) ?? extractPhone(text),
            str(ai?.email) ?? extractEmail(text),
            opis,
            str(ai?.miasto), str(ai?.ulica), str(ai?.wojewodztwo),
            assigneeId,
          ],
        )
        for (const c of comments) {
          const authorId = c.memberCreator ? trelloMemberToProfile.get(c.memberCreator.id) ?? null : null
          const content = authorId ? c.data.text! : `[Trello — ${c.memberCreator?.fullName ?? '?'}]\n${c.data.text}`
          await db.query(
            `INSERT INTO kontakt_komentarze (kontakt_id, user_id, content, created_at) VALUES ($1,$2,$3,$4)`,
            [kontakt.id, authorId, content, c.date],
          )
        }
        // Zdjęcia z załączników → galeria kontaktu (max 5, jak w API)
        const images = (card.attachments ?? []).filter(a => a.isUpload && a.mimeType?.startsWith('image/')).slice(0, 5)
        const zdjecia: string[] = []
        for (const img of images) {
          const url = await storeAttachment(card, img)
          if (url) zdjecia.push(url)
        }
        if (zdjecia.length) {
          await db.query(`UPDATE kontakty SET zdjecia = $1 WHERE id = $2`, [zdjecia, kontakt.id])
          stats.photos += zdjecia.length
        }
      }
    }
  }

  if (db) await db.end()
  if (geminiKey) saveAiCache()

  // ─── Raport ────────────────────────────────────────────────────────────────
  console.log(`\n=== Import Trello: „${board.name}" — ${commit ? 'ZAPISANO' : 'NA SUCHO (nic nie zapisano)'} ===`)
  console.log(`Nieruchomości: ${stats.properties} | Leady: ${stats.leads} | Kontakty: ${stats.kontakty}`)
  console.log(`Komentarze: ${stats.comments}${hasApi ? ' (pełne, z API)' : ' (TYLKO z eksportu — ucięte!)'} | Zadania: ${stats.tasks} | Dokumenty: ${stats.documents}`)
  if (commit && wantDownloads) console.log(`Pliki pobrane do Storage: ${stats.filesDownloaded} | Zdjęcia kontaktów: ${stats.photos} | Nieudane pobrania: ${stats.filesFailed}`)
  if (geminiKey && (aiCalls || aiFailures)) console.log(`AI (${GEMINI_MODEL}): zapytań ${aiCalls}, nieudanych ${aiFailures} (fallback: regexy) — cache: ${AI_CACHE_PATH}`)
  console.log(`Pominięte: archiwum/skip ${stats.skippedCards} | nagłówki sekcji ${stats.headerCards} | już zaimportowane ${stats.alreadyImported}`)

  if (perList.size) {
    console.log(`\nRozbicie per lista:`)
    for (const [k, v] of [...perList.entries()].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${String(v.count).padStart(4)} × ${k}`)
    }
  }
  if (skippedLists.size) {
    console.log(`\n⚠ Listy BEZ pasującej reguły (pominięte w całości) — dodaj do listRules:`)
    for (const l of skippedLists) console.log(`   - "${l}"`)
  }
  if (unmappedMembers.size) {
    console.log(`\n⚠ Użytkownicy Trello bez mapowania na konto CRM (autorzy trafią do treści komentarza):`)
    for (const u of unmappedMembers) console.log(`   - ${u}`)
  }
  if (!commit) console.log(`\nJeśli raport wygląda dobrze — uruchom ponownie z --commit`)
}

main().catch(e => { console.error(e); process.exit(1) })
