export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { canSeeAllTeams, canSeeInvestors, canManageTeams } from '@/lib/roles'

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

  // Inwestorzy — dane wrażliwe handlowo, widoczne tylko dla centrali i adminów
  if (typ === 'inwestor' && !canSeeInvestors(user.role)) return forbidden()

  // Widoczność: admin/manager/kierownik_centrali widzą wszystko; reszta —
  // tylko własne kontakty (assigned_to/created_by wśród visibleIds) plus
  // to, co zostało im jawnie udostępnione (kontakt_shares).
  let sharedIds: string[] = []
  if (!canSeeAllTeams(user.role) && visibleIds?.length) {
    const { data: shares } = await supabase
      .from('kontakt_shares')
      .select('kontakt_id')
      .eq('shared_with_user_id', user.id)
    sharedIds = (shares ?? []).map(s => s.kontakt_id)
  }

  // Supabase ucina pojedyncze zapytanie do 1000 wierszy — po imporcie z Trello
  // kontaktów jest znacznie więcej, więc stronicujemy po stronie serwera
  // i zwracamy komplet (filtry muszą być nakładane na KAŻDĄ stronę od nowa).
  function buildQuery(from: number, to: number) {
    let query = supabase.from('kontakty').select(SELECT_WITH_RELATIONS)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (!canSeeInvestors(user!.role)) query = query.neq('typ', 'inwestor')
    if (!canSeeAllTeams(user!.role) && visibleIds?.length) {
      const ids = visibleIds.join(',')
      const clauses = [`assigned_to.in.(${ids})`, `created_by.in.(${ids})`]
      if (sharedIds.length) clauses.push(`id.in.(${sharedIds.join(',')})`)
      query = query.or(clauses.join(','))
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

  const PAGE = 1000
  const MAX_ROWS = 20000 // bezpiecznik — przy takiej skali czas na prawdziwą paginację w UI
  const all: unknown[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  if (body.typ === 'inwestor' && !canSeeInvestors(user.role)) return forbidden()
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
