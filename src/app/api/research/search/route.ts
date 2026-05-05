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

interface SearchResults {
  krs: KrsEntity[]
  ceidg: CeidgEntry[]
  google: GoogleResult[]
  searchLinks: { label: string; url: string }[]
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

/** Fetch full KRS entity data by KRS number from prs.ms.gov.pl */
async function fetchKrsByNumber(krsNumber: string): Promise<KrsEntity | null> {
  try {
    const url = `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${krsNumber}?rejestr=P&format=json`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()

    const odpis = data?.odpis
    const podmiot = odpis?.dane?.dzial1?.danePodmiotu
    const siedziba = odpis?.dane?.dzial1?.siedzibaIAdres

    if (!podmiot) return null

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
  } catch {
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

async function scrapeKrsFromUrl(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    // Read at most 300 KB to avoid downloading huge pages
    const reader = res.body?.getReader()
    if (!reader) return []
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
      chunks.reduce((acc, c) => { const merged = new Uint8Array(acc.length + c.length); merged.set(acc); merged.set(c, acc.length); return merged }, new Uint8Array())
    )
    return extractKrsNumbers(stripHtml(html))
  } catch {
    return []
  }
}

async function searchKRS(name: string, googleResults: GoogleResult[]): Promise<KrsEntity[]> {
  const results: KrsEntity[] = []

  // Step 1: extract KRS numbers from Google snippets/titles/links
  const krsNumbers = new Set<string>()
  for (const g of googleResults) {
    for (const n of extractKrsNumbers(`${g.title} ${g.snippet} ${g.link}`)) {
      krsNumbers.add(n)
    }
  }

  // Step 1b: scrape HTML of registry pages found by Google — much deeper than snippets
  const registryUrls = googleResults.map(g => g.link).filter(isRegistryUrl).slice(0, 4)
  // Also scrape non-registry pages if we have few results so far, up to 2 extra
  const extraUrls = krsNumbers.size === 0
    ? googleResults.map(g => g.link).filter(u => !isRegistryUrl(u)).slice(0, 2)
    : []
  const urlsToScrape = [...new Set([...registryUrls, ...extraUrls])]

  if (urlsToScrape.length > 0) {
    const scraped = await Promise.all(urlsToScrape.map(scrapeKrsFromUrl))
    for (const nums of scraped) {
      for (const n of nums) krsNumbers.add(n)
    }
  }

  // Step 2: fetch KRS entity data for each number found
  if (krsNumbers.size > 0) {
    const fetched = await Promise.all(
      [...krsNumbers].slice(0, 5).map(fetchKrsByNumber)
    )
    for (const entity of fetched) {
      if (entity) results.push(entity)
    }
  }

  // Step 3: fallback — direct KRS name search (often misses, but free)
  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1]
      const firstName = nameParts.slice(0, -1).join(' ')

      const personUrl = `https://api-krs.ms.gov.pl/api/krs/OsobaFizyczna?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}&format=json`
      const personRes = await fetch(personUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })

      if (personRes.ok) {
        const personData = await personRes.json()
        const personList: Array<{ numerKRS?: string; nazwa?: string; nip?: string; regon?: string; funkcja?: string }> = Array.isArray(personData) ? personData : (personData?.items || [])
        const newNumbers = personList
          .map(item => item.numerKRS || '')
          .filter(n => n && !results.some(r => r.krs === n))
          .slice(0, 5)

        const fetched = await Promise.all(newNumbers.map(fetchKrsByNumber))
        for (const entity of fetched) {
          if (entity) results.push(entity)
        }
      }
    }
  } catch (e) {
    console.error('KRS fallback search error:', e)
  }

  return results
}

async function searchCEIDG(name: string): Promise<CeidgEntry[]> {
  const results: CeidgEntry[] = []

  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length < 2) return results

    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')

    // CEIDG API v2
    const token = process.env.CEIDG_API_TOKEN
    if (!token) {
      // Without token, return empty — user needs to configure
      return results
    }

    const url = `https://dane.biznes.gov.pl/api/ceidg/v2/firmy?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const data = await res.json()
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
    }
  } catch (e) {
    console.error('CEIDG search error:', e)
  }

  return results
}

async function searchGoogle(name: string): Promise<GoogleResult[]> {
  const results: GoogleResult[] = []

  try {
    const apiKey = process.env.GOOGLE_API_KEY
    const cx = process.env.GOOGLE_CX
    if (!apiKey || !cx) return results

    // KRS query first — results will be used to extract KRS numbers
    const queries = [
      `"${name}" KRS numer spółka`,
      `"${name}" telefon kontakt email`,
    ]

    for (const q of queries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=5&lr=lang_pl`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

      if (res.ok) {
        const data = await res.json()
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
      }
    }
  } catch (e) {
    console.error('Google search error:', e)
  }

  return results
}

function generateSearchLinks(name: string, kwNumber?: string): { label: string; url: string }[] {
  const encodedName = encodeURIComponent(name)
  const links: { label: string; url: string }[] = []

  links.push({
    label: 'Google',
    url: `https://www.google.com/search?q=${encodedName}`,
  })
  links.push({
    label: 'Google + telefon',
    url: `https://www.google.com/search?q=${encodedName}+telefon+kontakt`,
  })
  links.push({
    label: 'Google + firma',
    url: `https://www.google.com/search?q=${encodedName}+firma+spółka`,
  })
  links.push({
    label: 'Facebook',
    url: `https://www.facebook.com/search/people/?q=${encodedName}`,
  })
  links.push({
    label: 'LinkedIn',
    url: `https://www.linkedin.com/search/results/people/?keywords=${encodedName}`,
  })
  links.push({
    label: 'Rejestr.io',
    url: `https://rejestr.io/szukaj?q=${encodedName}`,
  })
  links.push({
    label: 'Panorama Firm',
    url: `https://panoramafirm.pl/szukaj?k=${encodedName}`,
  })
  links.push({
    label: 'KRS Online',
    url: `https://www.krs-online.com.pl/szukaj.php?q=${encodedName}`,
  })

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

  // Google runs first — its results feed KRS number extraction
  const [google, ceidg] = await Promise.all([
    searchGoogle(name),
    searchCEIDG(name),
  ])
  // KRS uses Google results to find entity numbers before direct lookup
  const krs = await searchKRS(name, google)

  const searchLinks = generateSearchLinks(name, kwNumber)

  const results: SearchResults = { krs, ceidg, google, searchLinks }

  return NextResponse.json(results)
}
