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
  website?: string
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

async function searchKRS(name: string, krsNumber?: string): Promise<KrsEntity[]> {
  const results: KrsEntity[] = []

  // If a KRS number is provided, fetch directly from the official Open API
  if (krsNumber) {
    try {
      const paddedKrs = krsNumber.replace(/\D/g, '').padStart(10, '0')
      const url = `https://api-krs.ms.gov.pl/api/krs/OdpisPelny/${paddedKrs}?rejestr=P&format=json`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })

      if (res.ok) {
        const data = await res.json()
        const dane = data?.odpis?.dane
        if (dane) {
          const dzial1 = dane.dzial1 || {}
          const dzial2 = dane.dzial2 || {}

          const nazwaArr = dzial1.danePodmiotu?.nazwa || []
          const lastNazwa = Array.isArray(nazwaArr) ? nazwaArr[nazwaArr.length - 1] : nazwaArr
          const entityName = lastNazwa?.nazwa || ''

          const identArr = dzial1.danePodmiotu?.identyfikatory || []
          const lastIdent = Array.isArray(identArr) ? identArr[identArr.length - 1] : identArr
          const nip = lastIdent?.identyfikatory?.nip || ''
          const regon = lastIdent?.identyfikatory?.regon || ''

          const adres = dzial1.siedzibaIAdres?.adres || {}
          const address = [adres.ulica, adres.nrDomu, adres.miejscowosc, adres.kodPocztowy].filter(Boolean).join(', ')
          const website = dzial1.siedzibaIAdres?.adresStronyInternetowej || ''

          results.push({
            name: entityName,
            krs: paddedKrs,
            nip,
            regon,
            address,
            role: 'podmiot',
            website: website || undefined,
          })

          // Extract board members / representatives from dzial2
          const organRepr = dzial2?.organReprezentacji?.sklad || []
          if (Array.isArray(organRepr)) {
            for (const member of organRepr.slice(0, 10)) {
              const lastEntry = Array.isArray(member) ? member[member.length - 1] : member
              const memberName = [lastEntry?.imiona, lastEntry?.nazwisko].filter(Boolean).join(' ')
              const memberRole = lastEntry?.funkcjaWOrganie || 'członek zarządu'
              if (memberName) {
                results.push({
                  name: memberName,
                  krs: paddedKrs,
                  nip: '',
                  regon: '',
                  address: '',
                  role: memberRole,
                })
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('KRS number lookup error:', e)
    }
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

    // Search for person + contact info (uses 2 of 100 daily queries)
    const queries = [
      `${name} telefon kontakt email`,
      `${name} firma spółka KRS`,
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
  links.push({
    label: 'Wyszukiwarka KRS (gov)',
    url: `https://wyszukiwarka-krs.ms.gov.pl/`,
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

  const { personName, kwNumber, krsNumber } = await req.json()

  if (!personName?.trim()) {
    return NextResponse.json({ error: 'Wymagane imię i nazwisko' }, { status: 400 })
  }

  const name = personName.trim()

  // Run KRS, CEIDG, and Google searches in parallel
  const [krs, ceidg, google] = await Promise.all([
    searchKRS(name, krsNumber?.trim() || undefined),
    searchCEIDG(name),
    searchGoogle(name),
  ])

  const searchLinks = generateSearchLinks(name, kwNumber)

  const results: SearchResults = { krs, ceidg, google, searchLinks }

  return NextResponse.json(results)
}
