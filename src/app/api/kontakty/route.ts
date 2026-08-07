export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { canSeeAllTeams, canSeeInvestors, canManageTeams } from '@/lib/roles'
import { getUserGrants, hasKontaktTypeGrant, userCanSeeInvestors } from '@/lib/access'

const SELECT_WITH_RELATIONS = `*,
  creator:profiles!kontakty_created_by_fkey(id,full_name,avatar_url),
  assignee:profiles!kontakty_assigned_to_fkey(id,full_name,avatar_url)`

const BOOL_FLAGS = [
  'wizyta_osobista', 'wyslany_mail_oferta', 'chec_wspolpracy', 'niezainteresowani',
  'zgoda_ulotki', 'zgoda_plakat', 'operator_budowy_zainteresowani',
]

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const sp = req.nextUrl.searchParams

  const typ = sp.get('typ')
  const wojewodztwo = sp.get('wojewodztwo')
  const miasto = sp.get('miasto')
  const assignedTo = sp.get('assigned_to')
  const search = sp.get('search')
  const visibleIds = sp.get('visibleIds')?.split(',').filter(Boolean)

  // Granty dostępu (panel dostępów): mogą odblokować typy kontaktów —
  // całą kategorię (np. wszyscy inwestorzy) albo rekordy konkretnej osoby.
  const grants = await getUserGrants(supabase, user.id)
  const canInvestor = canSeeInvestors(user.role) || hasKontaktTypeGrant(grants, 'inwestor')

  // Inwestorzy — dane wrażliwe handlowo; widoczne dla centrali/adminów oraz
  // userów z nadanym grantem na inwestorów
  if (typ === 'inwestor' && !canInvestor) return forbidden()

  // Dodatkowe warunki widoczności z grantów (dla wariantu „own"):
  //  - cała kategoria typu T  → typ.eq.T (dowolny właściciel),
  //  - per-osoba typu T       → and(typ.eq.T, właściciel wśród nadanych).
  const grantConds: string[] = []
  for (const [t, g] of Object.entries(grants.kontaktTypes)) {
    if (!g) continue
    if (g.all) grantConds.push(`typ.eq.${t}`)
    else if (g.userIds.length) {
      const gy = g.userIds.join(',')
      grantConds.push(`and(typ.eq.${t},assigned_to.in.(${gy}))`)
      grantConds.push(`and(typ.eq.${t},created_by.in.(${gy}))`)
    }
  }

  // Widoczność: admin/manager/kierownik_centrali widzą wszystko; reszta —
  // tylko własne kontakty (assigned_to/created_by wśród visibleIds), plus
  // to, co zostało im jawnie udostępnione (kontakt_shares), plus granty.
  //
  // Udostępnienia idą przez złączenie kontakt_shares!inner, a NIE przez
  // listę id.in.(...) — po „Udostępnij miasto" agent ma setki udostępnień
  // i lista ID rozsadzała URL zapytania do PostgREST (błąd 500 → agentowi
  // „znikała" cała baza kontaktów, łącznie z własnymi).
  const restricted = !canSeeAllTeams(user.role) && !!visibleIds?.length

  function buildQuery(from: number, to: number, variant: 'all' | 'own' | 'shared') {
    const select = variant === 'shared'
      ? `${SELECT_WITH_RELATIONS}, kontakt_shares!inner(shared_with_user_id)`
      : SELECT_WITH_RELATIONS
    let query = supabase.from('kontakty').select(select)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (!canInvestor) query = query.neq('typ', 'inwestor')
    if (variant === 'own') {
      const ids = visibleIds!.join(',')
      query = query.or([`assigned_to.in.(${ids})`, `created_by.in.(${ids})`, ...grantConds].join(','))
    } else if (variant === 'shared') {
      query = query.eq('kontakt_shares.shared_with_user_id', user!.id)
    }
    if (typ) query = query.eq('typ', typ)
    if (wojewodztwo) query = query.eq('wojewodztwo', wojewodztwo)
    if (miasto) query = query.eq('miasto', miasto)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    for (const flag of BOOL_FLAGS) {
      if (sp.get(flag) === '1') query = query.eq(flag, true)
    }
    if (search) {
      const s = search.replace(/[%,()]/g, ' ')
      query = query.or(`nazwa.ilike.%${s}%,miasto.ilike.%${s}%,ulica.ilike.%${s}%,wojewodztwo.ilike.%${s}%`)
    }
    return query
  }

  // Supabase ucina pojedyncze zapytanie do 1000 wierszy — po imporcie z Trello
  // kontaktów jest znacznie więcej, więc stronicujemy po stronie serwera
  // i zwracamy komplet (filtry muszą być nakładane na KAŻDĄ stronę od nowa).
  const PAGE = 1000
  const MAX_ROWS = 20000 // bezpiecznik — przy takiej skali czas na prawdziwą paginację w UI

  async function fetchAll(variant: 'all' | 'own' | 'shared'): Promise<{ rows: Record<string, unknown>[] } | { error: string }> {
    const rows: Record<string, unknown>[] = []
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await buildQuery(from, from + PAGE - 1, variant)
      if (error) return { error: error.message }
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]))
      if (!data || data.length < PAGE) break
    }
    return { rows }
  }

  const variants: ('all' | 'own' | 'shared')[] = restricted ? ['own', 'shared'] : ['all']
  const byId = new Map<string, Record<string, unknown>>()
  for (const variant of variants) {
    const res = await fetchAll(variant)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 })
    for (const row of res.rows) {
      delete row.kontakt_shares // techniczne pole złączenia — nie wystawiamy
      if (!byId.has(row.id as string)) byId.set(row.id as string, row)
    }
  }
  const all = [...byId.values()].sort((a, b) =>
    String(a.created_at) < String(b.created_at) ? 1 : -1
  )
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  // Tworzenie inwestora — rola LUB grant na inwestorów (kuracja objęta grantem)
  if (body.typ === 'inwestor' && !(await userCanSeeInvestors(supabase, user.id, user.role))) return forbidden()
  // Przypisywanie kontaktu do innego agenta — tylko centrala/admin. Zwykły
  // user zawsze staje się właścicielem własnego nowego kontaktu.
  if (!canManageTeams(user.role)) body.assigned_to = user.id
  // Auto-geokodowanie przy tworzeniu (nieblokujące — brak współrzędnych to null)
  const coords = await geocodeAddress(body.ulica, body.miasto, body.wojewodztwo)

  const { data: kontakt, error } = await supabase
    .from('kontakty')
    .insert({ ...body, created_by: user.id, ...(coords ?? {}) })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(kontakt, { status: 201 })
}
