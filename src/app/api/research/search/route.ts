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

interface SearchResults {
  krs: KrsEntity[]
  ceidg: CeidgEntry[]
  google: GoogleResult[]
  contacts: ExtractedContact[]
  searchLinks: { label: string; url: string }[]
}

interface ScrapedPage {
  url: string
  krsNumbers: string[]
  phones: string[]
  emails: string[]
}

/** Extract KRS numbers (10-digit, zero-padded) from arbitrary text */
function extractKrsNumbers(text: string): string[] {
  const found = new Set<string>()
  // Matches: "KRS 0000123456", "KRS: 0000123456", "KRS0000123456"
  Array.from(text.matchAll(/KRS[\s:]*(\d{10})/gi), m => found.add(m[1].padStart(10, '0')))
  // Bare 10-digit numbers that look like KRS (start with 0000)
  Array.from(text.matchAll(/\b(0000\d{6})\b/g), m => found.add(m[1]))
  return Array.from(found)
}

/** Extract Polish phone numbers and emails from text */
function extractContactInfo(text: string): { phones: string[], emails: string[] } {
  const phones = new Set<string>()
  const emails = new Set<string>()

  // +48 XXX XXX XXX (with any separators)
  Array.from(text.matchAll(/\+48[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g), m =>
    phones.add(`+48 ${m[1]} ${m[2]} ${m[3]}`)
  )
  // XXX-XXX-XXX or XXX XXX XXX with separators, Polish mobile prefix 5-8
  Array.from(text.matchAll(/\b([5-8]\d{2})[.\s-](\d{3})[.\s-](\d{3})\b/g), m =>
    phones.add(`+48 ${m[1]} ${m[2]} ${m[3]}`)
  )
  // Emails
  Array.from(text.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g), m => {
    const email = m[0].toLowerCase()
    if (!email.includes('example') && !email.includes('noreply') && !email.includes('sentry')) {
      emails.add(email)
    }
  })

  return {
    phones: Array.from(phones).slice(0, 5),
    emails: Array.from(emails).slice(0, 5),
  }
}

/** Fetch full KRS entity data by KRS number from api-krs.ms.gov.pl */
async function fetchKrsByNumber(krsNumber: string): Promise<KrsEntity | null> {
  try {
    const url = `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${krsNumber}?rejestr=P&format=json`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.log(`[KRS] fetchKrsByNumber ${krsNumber}: HTTP ${res.status}`)
      return null
    }
    const data = await res.json()

    const odpis = data?.odpis
    const podmiot = odpis?.dane?.dzial1?.danePodmiotu
    const siedziba = odpis?.dane?.dzial1?.siedzibaIAdres

    if (!podmiot) {
      console.log(`[KRS] fetchKrsByNumber ${krsNumber}: brak danePodmiotu w odpowiedzi`)
      return null
    }

    const miasto = siedziba?.adres?.miejscowosc || siedziba?.siedziba?.miejscowosc || ''
    const ulica = siedziba?.adres?.ulica || ''
    const nrDomu = siedziba?.adres?.nrDomu || ''
    const address = [miasto, ulica, nrDomu].filter(Boolean).join(', ')

    return {
      name: podmiot?.nazwa || '',
      krs: krsNumber,
      nip: podmiot?.identyfikatory?.nip || '',
      regon: podmiot?.identyfikatory?.regon || '',
      address,
      role: 'podmiot (KRS)',
    }
  } catch (e) {
    console.log(`[KRS] fetchKrsByNumber ${krsNumber}: błąd`, e)
    return null
  }
}

/** Domains known to list KRS numbers — prioritized for HTML scraping */
const KRS_REGISTRY_DOMAINS = [
  'rejestr.io',
  'krs-online.com.pl',
  'mojepanstwo.pl',
  'infoveriti.pl',
  'aleo.com',
  'ekrs.ms.gov.pl',
  'prs.ms.gov.pl',
  'biznes.gov.pl',
  'cominfo.pl',
  'sprawdz-firme.pl',
  'centrumkrs.pl',
  'sprawdzfirme.pl',
  'biznesradar.pl',
]

function isRegistryUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return KRS_REGISTRY_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch {
    return false
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
}

async function scrapePage(url: string): Promise<ScrapedPage> {
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
      console.log(`[SCRAPE] ${url}: HTTP ${res.status}`)
      return empty
    }

    // Read at most 300 KB
    const reader = res.body?.getReader()
    if (!reader) return empty
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (bytes < 300_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      bytes += value.length
    }
    reader.cancel().catch(() => {})

    const html = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length)
        merged.set(acc)
        merged.set(c, acc.length)
        return merged
      }, new Uint8Array())
    )
    const text = stripHtml(html)
    const krsNumbers = extractKrsNumbers(text)
    const { phones, emails } = extractContactInfo(text)

    console.log(`[SCRAPE] ${url}: KRS=${krsNumbers.length} tel=${phones.length} email=${emails.length}`)
    return { url, krsNumbers, phones, emails }
  } catch (e) {
    console.log(`[SCRAPE] ${url}: błąd`, (e as Error).message)
    return empty
  }
}

/** Scrape known registries directly by name — no Google API needed */
async function scrapeRegistriesDirect(name: string): Promise<ScrapedPage[]> {
  const encoded = encodeURIComponent(name)
  const directUrls = [
    `https://rejestr.io/szukaj?q=${encoded}`,
    `https://www.krs-online.com.pl/szukaj.php?q=${encoded}`,
    `https://mojepanstwo.pl/szukanie?q=${encoded}`,
  ]
  console.log(`[KRS] Scraping bezpośredni rejestrów dla "${name}"`)
  return Promise.all(directUrls.map(scrapePage))
}

async function searchKRS(name: string, googleResults: GoogleResult[]): Promise<{ entities: KrsEntity[], contacts: ExtractedContact[] }> {
  const entities: KrsEntity[] = []
  const contacts: ExtractedContact[] = []

  // Step 1: extract KRS numbers from Google snippets/titles/links
  const krsNumbers = new Set<string>()
  const krsSourceMap = new Map<string, string>() // krsNumber → sourceUrl

  for (const g of googleResults) {
    for (const n of extractKrsNumbers(`${g.title} ${g.snippet} ${g.link}`)) {
      krsNumbers.add(n)
      if (!krsSourceMap.has(n)) krsSourceMap.set(n, g.link)
    }
    // Also grab contacts from snippet text
    const { phones, emails } = extractContactInfo(`${g.title} ${g.snippet}`)
    if (phones.length > 0 || emails.length > 0) {
      contacts.push({ phones, emails, sourceUrl: g.link, sourceTitle: g.title })
    }
  }
  console.log(`[KRS] Ze snippetów Google: ${krsNumbers.size} numerów KRS`)

  // Step 2: scrape registry pages from Google results + always scrape known registries directly
  const registryUrls = googleResults.map(g => g.link).filter(isRegistryUrl).slice(0, 3)
  const extraUrls = krsNumbers.size === 0
    ? googleResults.map(g => g.link).filter(u => !isRegistryUrl(u)).slice(0, 2)
    : []
  const urlsToScrape = Array.from(new Set(registryUrls.concat(extraUrls)))

  // Run Google-sourced scraping and direct registry scraping in parallel
  const [googleScraped, directScraped] = await Promise.all([
    urlsToScrape.length > 0
      ? Promise.all(urlsToScrape.map(scrapePage))
      : Promise.resolve([] as ScrapedPage[]),
    scrapeRegistriesDirect(name),
  ])

  const allScraped = googleScraped.concat(directScraped)
  console.log(`[KRS] Scraping łącznie ${allScraped.length} stron`)

  for (const page of allScraped) {
    for (const n of page.krsNumbers) {
      krsNumbers.add(n)
      if (!krsSourceMap.has(n)) krsSourceMap.set(n, page.url)
    }
    if (page.phones.length > 0 || page.emails.length > 0) {
      const googleItem = googleResults.find(g => g.link === page.url)
      contacts.push({
        phones: page.phones,
        emails: page.emails,
        sourceUrl: page.url,
        sourceTitle: googleItem?.title || new URL(page.url).hostname,
      })
    }
  }
  console.log(`[KRS] Po scrapingu: ${krsNumbers.size} numerów KRS łącznie`)

  // Step 3: fetch KRS entity data for each number found
  if (krsNumbers.size > 0) {
    const numbered = Array.from(krsNumbers).slice(0, 5)
    console.log(`[KRS] Pobieranie danych dla: ${numbered.join(', ')}`)
    const fetched = await Promise.all(numbered.map(fetchKrsByNumber))
    for (let i = 0; i < fetched.length; i++) {
      const entity = fetched[i]
      if (entity) {
        entity.sourceUrl = krsSourceMap.get(numbered[i])
        entities.push(entity)
      }
    }
  }

  // Step 4: fallback — direct KRS OsobaFizyczna API by name
  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1]
      const firstName = nameParts.slice(0, -1).join(' ')

      const personUrl = `https://api-krs.ms.gov.pl/api/krs/OsobaFizyczna?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}&format=json`
      console.log(`[KRS] Fallback OsobaFizyczna: ${personUrl}`)
      const personRes = await fetch(personUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })

      if (personRes.ok) {
        const personData = await personRes.json()
        const personList: Array<{ numerKRS?: string }> = Array.isArray(personData) ? personData : (personData?.items || [])
        console.log(`[KRS] OsobaFizyczna zwróciła ${personList.length} wyników`)
        const newNumbers = personList
          .map(item => item.numerKRS || '')
          .filter(n => n && !entities.some(r => r.krs === n))
          .slice(0, 5)

        const fetched = await Promise.all(newNumbers.map(fetchKrsByNumber))
        for (const entity of fetched) {
          if (entity) {
            entity.sourceUrl = `https://api-krs.ms.gov.pl/api/krs/OsobaFizyczna?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}&format=json`
            entities.push(entity)
          }
        }
      } else {
        console.log(`[KRS] OsobaFizyczna HTTP ${personRes.status}`)
      }
    }
  } catch (e) {
    console.error('[KRS] Fallback search error:', e)
  }

  console.log(`[KRS] Wynik końcowy: ${entities.length} podmiotów, ${contacts.length} kontaktów`)
  return { entities, contacts }
}

async function searchCEIDG(name: string): Promise<CeidgEntry[]> {
  const results: CeidgEntry[] = []

  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length < 2) return results

    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')

    const token = process.env.CEIDG_API_TOKEN
    if (!token) {
      console.log('[CEIDG] Brak CEIDG_API_TOKEN — pomijam')
      return results
    }

    const url = `https://dane.biznes.gov.pl/api/ceidg/v2/firmy?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}`
    console.log(`[CEIDG] Szukam: ${url}`)
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const data = await res.json()
      console.log(`[CEIDG] Znaleziono ${data?.firmy?.length || 0} firm`)
      if (data?.firmy) {
        for (const firma of data.firmy.slice(0, 20)) {
          results.push({
            name: firma.nazwa || '',
            nip: firma.wlasciciel?.nip || '',
            regon: firma.regon || '',
            address: firma.adresDzialalnosci
              ? [firma.adresDzialalnosci.miasto, firma.adresDzialalnosci.ulica, firma.adresDzialalnosci.budynek].filter(Boolean).join(', ')
              : '',
            phone: firma.dataKontaktowe?.telefon || null,
            email: firma.dataKontaktowe?.email || null,
            status: firma.status === 1 ? 'Aktywna' : firma.status === 2 ? 'Zawieszona' : 'Wykreślona',
          })
        }
      }
    } else {
      console.log(`[CEIDG] HTTP ${res.status}`)
    }
  } catch (e) {
    console.error('[CEIDG] search error:', e)
  }

  return results
}

async function searchGoogle(name: string): Promise<GoogleResult[]> {
  const results: GoogleResult[] = []

  try {
    const apiKey = process.env.GOOGLE_API_KEY
    const cx = process.env.GOOGLE_CX
    if (!apiKey || !cx) {
      console.log('[GOOGLE] Brak GOOGLE_API_KEY lub GOOGLE_CX — pomijam')
      return results
    }

    // First query targets KRS numbers; second targets contact info for individuals
    const queries = [
      `"${name}" KRS numer spółka`,
      `"${name}" telefon kontakt email`,
    ]

    for (const q of queries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=5&lr=lang_pl`
      console.log(`[GOOGLE] Zapytanie: ${q}`)
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

      if (res.ok) {
        const data = await res.json()
        console.log(`[GOOGLE] Wyników: ${data?.items?.length || 0} (searchInformation: ${JSON.stringify(data?.searchInformation?.totalResults)})`)
        if (data?.items) {
          for (const item of data.items) {
            if (results.some(r => r.link === item.link)) continue
            results.push({
              title: item.title || '',
              link: item.link || '',
              snippet: item.snippet || '',
            })
          }
        }
        if (data?.error) {
          console.log(`[GOOGLE] Błąd API: ${JSON.stringify(data.error)}`)
        }
      } else {
        const errText = await res.text().catch(() => '')
        console.log(`[GOOGLE] HTTP ${res.status}: ${errText.slice(0, 200)}`)
      }
    }
  } catch (e) {
    console.error('[GOOGLE] search error:', e)
  }

  console.log(`[GOOGLE] Łącznie ${results.length} unikalnych wyników`)
  return results
}

function generateSearchLinks(name: string, kwNumber?: string): { label: string; url: string }[] {
  const encodedName = encodeURIComponent(name)
  const links: { label: string; url: string }[] = []

  links.push({ label: 'Google', url: `https://www.google.com/search?q=${encodedName}` })
  links.push({ label: 'Google + telefon', url: `https://www.google.com/search?q=${encodedName}+telefon+kontakt` })
  links.push({ label: 'Google + firma', url: `https://www.google.com/search?q=${encodedName}+firma+spółka` })
  links.push({ label: 'Facebook', url: `https://www.facebook.com/search/people/?q=${encodedName}` })
  links.push({ label: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${encodedName}` })
  links.push({ label: 'Rejestr.io', url: `https://rejestr.io/szukaj?q=${encodedName}` })
  links.push({ label: 'Panorama Firm', url: `https://panoramafirm.pl/szukaj?k=${encodedName}` })
  links.push({ label: 'KRS Online', url: `https://www.krs-online.com.pl/szukaj.php?q=${encodedName}` })

  if (kwNumber) {
    links.push({
      label: 'Księga Wieczysta',
      url: `https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsijkiWieczyste/wyszukiwanieKW?nrKW=${encodeURIComponent(kwNumber)}`,
    })
  }

  return links
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { personName, kwNumber } = await req.json()

  if (!personName?.trim()) {
    return NextResponse.json({ error: 'Wymagane imię i nazwisko' }, { status: 400 })
  }

  const name = personName.trim()
  console.log(`\n[SEARCH] ===== Wyszukiwanie: "${name}" =====`)

  // Google + CEIDG równolegle; KRS czeka na wyniki Google
  const [google, ceidg] = await Promise.all([
    searchGoogle(name),
    searchCEIDG(name),
  ])

  const { entities: krs, contacts } = await searchKRS(name, google)

  const searchLinks = generateSearchLinks(name, kwNumber)

  console.log(`[SEARCH] ===== Koniec: KRS=${krs.length} CEIDG=${ceidg.length} Google=${google.length} Kontakty=${contacts.length} =====\n`)

  const results: SearchResults = { krs, ceidg, google, contacts, searchLinks }
  return NextResponse.json(results)
}
