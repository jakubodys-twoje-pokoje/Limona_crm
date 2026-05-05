export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

interface KrsEntity {
  name: string
  krs: string
  nip: string
  regon: string
  address: string
  role: string
  sourceUrl?: string
}

interface CeidgEntry {
  name: string
  nip: string
  regon: string
  address: string
  phone: string | null
  email: string | null
  status: string
}

interface GoogleResult {
  title: string
  link: string
  snippet: string
}

interface ExtractedContact {
  phones: string[]
  emails: string[]
  sourceUrl: string
  sourceTitle: string
}

export interface DebugEntry {
  tag: string
  msg: string
  ms: number
  ok: boolean
}

interface SearchResults {
  krs: KrsEntity[]
  ceidg: CeidgEntry[]
  google: GoogleResult[]
  contacts: ExtractedContact[]
  searchLinks: { label: string; url: string }[]
  _debug: DebugEntry[]
}

interface ScrapedPage {
  url: string
  krsNumbers: string[]
  phones: string[]
  emails: string[]
}

class DebugLog {
  private entries: DebugEntry[] = []
  private start = Date.now()

  log(tag: string, msg: string, ok = true) {
    const ms = Date.now() - this.start
    this.entries.push({ tag, msg, ms, ok })
    console.log(`[${tag}] +${ms}ms ${msg}`)
  }

  get(): DebugEntry[] { return this.entries }
}

function extractKrsNumbers(text: string): string[] {
  const found = new Set<string>()
  Array.from(text.matchAll(/KRS[\s:]*(\d{10})/gi), m => found.add(m[1].padStart(10, '0')))
  Array.from(text.matchAll(/\b(0000\d{6})\b/g), m => found.add(m[1]))
  return Array.from(found)
}

function extractContactInfo(text: string): { phones: string[], emails: string[] } {
  const phones = new Set<string>()
  const emails = new Set<string>()
  Array.from(text.matchAll(/\+48[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g), m =>
    phones.add(`+48 ${m[1]} ${m[2]} ${m[3]}`)
  )
  Array.from(text.matchAll(/\b([5-8]\d{2})[.\s-](\d{3})[.\s-](\d{3})\b/g), m =>
    phones.add(`+48 ${m[1]} ${m[2]} ${m[3]}`)
  )
  Array.from(text.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g), m => {
    const email = m[0].toLowerCase()
    if (!email.includes('example') && !email.includes('noreply') && !email.includes('sentry'))
      emails.add(email)
  })
  return { phones: Array.from(phones).slice(0, 5), emails: Array.from(emails).slice(0, 5) }
}

async function fetchKrsByNumber(krsNumber: string, log: DebugLog): Promise<KrsEntity | null> {
  try {
    const url = `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${krsNumber}?rejestr=P&format=json`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      log.log('KRS-API', `${krsNumber} → HTTP ${res.status}`, false)
      return null
    }
    const data = await res.json()
    const odpis = data?.odpis
    const podmiot = odpis?.dane?.dzial1?.danePodmiotu
    const siedziba = odpis?.dane?.dzial1?.siedzibaIAdres
    if (!podmiot) {
      log.log('KRS-API', `${krsNumber} → brak danePodmiotu`, false)
      return null
    }
    const miasto = siedziba?.adres?.miejscowosc || siedziba?.siedziba?.miejscowosc || ''
    const ulica = siedziba?.adres?.ulica || ''
    const nrDomu = siedziba?.adres?.nrDomu || ''
    const address = [miasto, ulica, nrDomu].filter(Boolean).join(', ')
    log.log('KRS-API', `${krsNumber} → OK: ${podmiot?.nazwa}`)
    return {
      name: podmiot?.nazwa || '',
      krs: krsNumber,
      nip: podmiot?.identyfikatory?.nip || '',
      regon: podmiot?.identyfikatory?.regon || '',
      address,
      role: 'podmiot (KRS)',
    }
  } catch (e) {
    log.log('KRS-API', `${krsNumber} → błąd: ${(e as Error).message}`, false)
    return null
  }
}

const KRS_REGISTRY_DOMAINS = [
  'rejestr.io', 'krs-online.com.pl', 'mojepanstwo.pl', 'infoveriti.pl',
  'aleo.com', 'ekrs.ms.gov.pl', 'prs.ms.gov.pl', 'biznes.gov.pl',
  'cominfo.pl', 'sprawdz-firme.pl', 'centrumkrs.pl', 'sprawdzfirme.pl', 'biznesradar.pl',
]

function isRegistryUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return KRS_REGISTRY_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch { return false }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
}

async function scrapePage(url: string, log: DebugLog): Promise<ScrapedPage> {
  const empty: ScrapedPage = { url, krsNumbers: [], phones: [], emails: [] }
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      log.log('SCRAPE', `${url} → HTTP ${res.status}`, false)
      return empty
    }
    const reader = res.body?.getReader()
    if (!reader) return empty
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (bytes < 300_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value); bytes += value.length
    }
    reader.cancel().catch(() => {})
    const html = new TextDecoder().decode(
      chunks.reduce((acc, c) => { const m = new Uint8Array(acc.length + c.length); m.set(acc); m.set(c, acc.length); return m }, new Uint8Array())
    )
    const text = stripHtml(html)
    const krsNumbers = extractKrsNumbers(text)
    const { phones, emails } = extractContactInfo(text)
    log.log('SCRAPE', `${new URL(url).hostname} → KRS:${krsNumbers.length} tel:${phones.length} email:${emails.length}`, true)
    return { url, krsNumbers, phones, emails }
  } catch (e) {
    log.log('SCRAPE', `${url} → ${(e as Error).message}`, false)
    return empty
  }
}

async function scrapeRegistriesDirect(name: string, log: DebugLog): Promise<ScrapedPage[]> {
  const encoded = encodeURIComponent(name)
  const panoramaSlug = name.toLowerCase().replace(/\s+/g, '_')
  const directUrls = [
    `https://www.infoveriti.pl/firma,szukaj,${encoded}.html`,
    `https://aleo.com/pl/firmy?phrase=${encoded}`,
    `https://panoramafirm.pl/${panoramaSlug}`,
    `https://biznesradar.pl/spolki/szukaj?q=${encoded}`,
  ]
  log.log('SCRAPE', `Bezpośredni scraping ${directUrls.length} rejestrów`)
  return Promise.all(directUrls.map(u => scrapePage(u, log)))
}

async function searchKRS(name: string, googleResults: GoogleResult[], log: DebugLog): Promise<{ entities: KrsEntity[], contacts: ExtractedContact[] }> {
  const entities: KrsEntity[] = []
  const contacts: ExtractedContact[] = []
  const krsNumbers = new Set<string>()
  const krsSourceMap = new Map<string, string>()

  for (const g of googleResults) {
    for (const n of extractKrsNumbers(`${g.title} ${g.snippet} ${g.link}`)) {
      krsNumbers.add(n)
      if (!krsSourceMap.has(n)) krsSourceMap.set(n, g.link)
    }
  }
  log.log('KRS', `Ze snippetów Google: ${krsNumbers.size} numerów KRS`)

  const registryUrls = googleResults.map(g => g.link).filter(isRegistryUrl).slice(0, 3)
  const extraUrls = krsNumbers.size === 0
    ? googleResults.map(g => g.link).filter(u => !isRegistryUrl(u)).slice(0, 2)
    : []
  const urlsToScrape = Array.from(new Set(registryUrls.concat(extraUrls)))

  const [googleScraped, directScraped] = await Promise.all([
    urlsToScrape.length > 0 ? Promise.all(urlsToScrape.map(u => scrapePage(u, log))) : Promise.resolve([] as ScrapedPage[]),
    scrapeRegistriesDirect(name, log),
  ])

  // Direct scrape returns search result pages with many companies — collect only KRS numbers, not contacts
  for (const page of directScraped) {
    for (const n of page.krsNumbers) {
      krsNumbers.add(n)
      if (!krsSourceMap.has(n)) krsSourceMap.set(n, page.url)
    }
  }

  // Google-scraped pages point to specific profiles — contacts here are relevant
  for (const page of googleScraped) {
    for (const n of page.krsNumbers) {
      krsNumbers.add(n)
      if (!krsSourceMap.has(n)) krsSourceMap.set(n, page.url)
    }
    if (page.phones.length > 0 || page.emails.length > 0) {
      const googleItem = googleResults.find(g => g.link === page.url)
      contacts.push({ phones: page.phones, emails: page.emails, sourceUrl: page.url, sourceTitle: googleItem?.title || new URL(page.url).hostname })
    }
  }
  log.log('KRS', `Po scrapingu: ${krsNumbers.size} numerów KRS łącznie`)

  if (krsNumbers.size > 0) {
    const numbered = Array.from(krsNumbers).slice(0, 5)
    log.log('KRS', `Pobieranie OdpisAktualny dla: ${numbered.join(', ')}`)
    const fetched = await Promise.all(numbered.map(n => fetchKrsByNumber(n, log)))
    for (let i = 0; i < fetched.length; i++) {
      const entity = fetched[i]
      if (entity) { entity.sourceUrl = krsSourceMap.get(numbered[i]); entities.push(entity) }
    }
  }

  log.log('KRS', `Wynik: ${entities.length} podmiotów, ${contacts.length} kontaktów`)
  return { entities, contacts }
}

async function searchCEIDG(name: string, log: DebugLog): Promise<CeidgEntry[]> {
  const results: CeidgEntry[] = []
  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length < 2) return results
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')
    const token = process.env.CEIDG_API_TOKEN
    if (!token) { log.log('CEIDG', 'Brak tokena — pomijam', false); return results }
    const url = `https://dane.biznes.gov.pl/api/ceidg/v2/firmy?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}`
    log.log('CEIDG', `Szukam: ${firstName} ${lastName}`)
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = await res.json()
      log.log('CEIDG', `Znaleziono ${data?.firmy?.length || 0} firm`)
      if (data?.firmy) {
        for (const firma of data.firmy.slice(0, 20)) {
          results.push({
            name: firma.nazwa || '', nip: firma.wlasciciel?.nip || '', regon: firma.regon || '',
            address: firma.adresDzialalnosci ? [firma.adresDzialalnosci.miasto, firma.adresDzialalnosci.ulica, firma.adresDzialalnosci.budynek].filter(Boolean).join(', ') : '',
            phone: firma.dataKontaktowe?.telefon || null, email: firma.dataKontaktowe?.email || null,
            status: firma.status === 1 ? 'Aktywna' : firma.status === 2 ? 'Zawieszona' : 'Wykreślona',
          })
        }
      }
    } else {
      log.log('CEIDG', `HTTP ${res.status}`, false)
    }
  } catch (e) {
    log.log('CEIDG', `Błąd: ${(e as Error).message}`, false)
  }
  return results
}

function parseGoogleHtml(html: string): GoogleResult[] {
  const results: GoogleResult[] = []
  const seen = new Set<string>()

  // Extract all <a href="..."> with an <h3> inside — these are organic results
  const blockRe = /<a\s[^>]*href="(https?:\/\/(?!google\.)[^"]+)"[^>]*>[\s\S]{0,600}?<h3[^>]*>([\s\S]{0,300}?)<\/h3>/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null) {
    const link = m[1].split('&amp;')[0]
    if (seen.has(link)) continue
    seen.add(link)
    const title = stripHtml(m[2]).trim()
    if (!title) continue

    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 800)
    const snippet = stripHtml(after).trim().slice(0, 250)

    results.push({ title, link, snippet })
    if (results.length >= 15) break
  }
  return results
}

async function searchGoogle(name: string, log: DebugLog): Promise<GoogleResult[]> {
  const results: GoogleResult[] = []
  const seen = new Set<string>()
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
  }

  const registrySites = 'site:rejestr.io OR site:krs-online.com.pl OR site:infoveriti.pl OR site:aleo.com OR site:panoramafirm.pl'
  const queries = [
    `"${name}" (${registrySites})`,
    `"${name}" KRS numer spółka firma`,
    `"${name}" telefon kontakt email`,
  ]

  for (const q of queries) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=pl&num=10&gl=pl`
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        log.log('GOOGLE', `HTTP ${res.status} dla zapytania`, false)
        continue
      }
      const html = await res.text()
      if (html.includes('detected unusual traffic') || html.includes('CAPTCHA')) {
        log.log('GOOGLE', 'Blokada CAPTCHA — pomijam', false)
        break
      }
      const parsed = parseGoogleHtml(html)
      let added = 0
      for (const r of parsed) {
        if (!seen.has(r.link)) { seen.add(r.link); results.push(r); added++ }
      }
      log.log('GOOGLE', `"${q.slice(0, 50)}..." → ${added} wyników`)
    } catch (e) {
      log.log('GOOGLE', `Wyjątek: ${(e as Error).message}`, false)
    }
  }

  log.log('GOOGLE', `Łącznie ${results.length} unikalnych wyników`)
  return results
}

function generateSearchLinks(name: string, kwNumber?: string): { label: string; url: string }[] {
  const n = encodeURIComponent(name)
  const links = [
    { label: 'Google', url: `https://www.google.com/search?q=${n}` },
    { label: 'Google + telefon', url: `https://www.google.com/search?q=${n}+telefon+kontakt` },
    { label: 'Google + firma', url: `https://www.google.com/search?q=${n}+firma+spółka` },
    { label: 'Facebook', url: `https://www.facebook.com/search/people/?q=${n}` },
    { label: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${n}` },
    { label: 'Rejestr.io', url: `https://rejestr.io/szukaj?q=${n}` },
    { label: 'Panorama Firm', url: `https://panoramafirm.pl/szukaj?k=${n}` },
    { label: 'KRS Online', url: `https://www.krs-online.com.pl/szukaj.php?q=${n}` },
  ]
  if (kwNumber) links.push({ label: 'Księga Wieczysta', url: `https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsijkiWieczyste/wyszukiwanieKW?nrKW=${encodeURIComponent(kwNumber)}` })
  return links
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { personName, kwNumber } = await req.json()
  if (!personName?.trim()) return NextResponse.json({ error: 'Wymagane imię i nazwisko' }, { status: 400 })

  const name = personName.trim()
  const log = new DebugLog()
  log.log('SEARCH', `Start: "${name}"`)

  const [google, ceidg] = await Promise.all([searchGoogle(name, log), searchCEIDG(name, log)])
  const { entities: krs, contacts } = await searchKRS(name, google, log)
  const searchLinks = generateSearchLinks(name, kwNumber)

  log.log('SEARCH', `Koniec: KRS=${krs.length} CEIDG=${ceidg.length} Google=${google.length} Kontakty=${contacts.length}`)

  return NextResponse.json({ krs, ceidg, google, contacts, searchLinks, _debug: log.get() })
}
