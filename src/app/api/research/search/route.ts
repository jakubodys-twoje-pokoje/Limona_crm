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

interface SearchResults {
  krs: KrsEntity[]
  ceidg: CeidgEntry[]
  searchLinks: { label: string; url: string }[]
}

async function searchKRS(name: string): Promise<KrsEntity[]> {
  const results: KrsEntity[] = []

  try {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length < 2) return results

    const lastName = nameParts[nameParts.length - 1]
    const firstName = nameParts.slice(0, -1).join(' ')

    // prs.ms.gov.pl Open API — search by company name
    const nameSearchUrl = `https://prs.ms.gov.pl/krs/openApi/search/podmiot?nazwa=${encodeURIComponent(name)}`
    const nameRes = await fetch(nameSearchUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (nameRes.ok) {
      const data = await nameRes.json()
      const items = data?.items || data?.odppisPelnyArr || data || []
      const list = Array.isArray(items) ? items : []
      for (const item of list.slice(0, 20)) {
        results.push({
          name: item.nazwa || item.name || '',
          krs: item.krs || item.krsNumber || '',
          nip: item.nip || '',
          regon: item.regon || '',
          address: item.adres || item.address || [item.miejscowosc, item.ulica, item.nrDomu].filter(Boolean).join(', ') || '',
          role: 'podmiot',
        })
      }
    }

    // prs.ms.gov.pl Open API — search by person name (osoba)
    const personUrl = `https://prs.ms.gov.pl/krs/openApi/search/osoba?imie=${encodeURIComponent(firstName)}&nazwisko=${encodeURIComponent(lastName)}`
    const personRes = await fetch(personUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (personRes.ok) {
      const personData = await personRes.json()
      const personItems = personData?.items || personData?.odppisPelnyArr || personData || []
      const personList = Array.isArray(personItems) ? personItems : []
      for (const item of personList.slice(0, 20)) {
        const krsNum = item.krs || item.krsNumber || ''
        if (results.some(r => r.krs === krsNum && krsNum)) continue
        results.push({
          name: item.nazwa || item.name || '',
          krs: krsNum,
          nip: item.nip || '',
          regon: item.regon || '',
          address: item.adres || item.address || [item.miejscowosc, item.ulica, item.nrDomu].filter(Boolean).join(', ') || '',
          role: item.funkcja || item.role || 'osoba w zarządzie/wspólnik',
        })
      }
    }
  } catch (e) {
    console.error('KRS search error:', e)
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

  // Run KRS and CEIDG searches in parallel
  const [krs, ceidg] = await Promise.all([
    searchKRS(name),
    searchCEIDG(name),
  ])

  const searchLinks = generateSearchLinks(name, kwNumber)

  const results: SearchResults = { krs, ceidg, searchLinks }

  return NextResponse.json(results)
}
