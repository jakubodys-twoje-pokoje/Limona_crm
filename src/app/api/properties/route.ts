export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { ARCHIVE_RETENTION_DAYS } from '@/lib/stages'
import { getUserGrants } from '@/lib/access'
import { canSeeAllProperties } from '@/lib/roles'

const SELECT_WITH_RELATIONS = `*,
  creator:profiles!properties_created_by_fkey(id,full_name,avatar_url),
  assignee:profiles!properties_assigned_to_fkey(id,full_name,avatar_url),
  kontakt:kontakty!properties_kontakt_id_fkey(id,nazwa,ostatnia_wizyta)`

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { searchParams } = req.nextUrl
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)
  const archived = searchParams.get('archived') === '1'

  // Archiwum trzymamy maksymalnie ARCHIVE_RETENTION_DAYS — starsze usuwamy
  // leniwie przy każdym listowaniu (bez osobnego crona). DELETE jest
  // idempotentny i najczęściej niczego nie dotyka.
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
  await supabase.from('properties').delete().lt('archived_at', cutoff)

  let query = supabase
    .from('properties')
    .select(SELECT_WITH_RELATIONS)

  // Domyślnie tylko aktywne (bez archiwum); ?archived=1 → tylko archiwum
  if (archived) {
    query = query.not('archived_at', 'is', null).order('archived_at', { ascending: false })
  } else {
    query = query.is('archived_at', null).order('created_at', { ascending: false })
  }

  // Granty dostępu: „cała kategoria" znosi filtr, granty per-osoba dokładają
  // widoczność rekordów wskazanych właścicieli. Dodatkowo dział prawny widzi
  // całą bazę nieruchomości — prowadzi sprawy na cudzych nieruchomościach.
  const grants = await getUserGrants(supabase, user.id)
  if (visibleIds?.length && !grants.nieruchomosci.all && !canSeeAllProperties(user.role)) {
    const ids = [...new Set([...visibleIds, ...grants.nieruchomosci.userIds])].join(',')
    // widać też nieruchomości, gdzie user jest dodatkowym opiekunem (co_assignees[])
    query = query.or(`assigned_to.in.(${ids}),created_by.in.(${ids}),co_assignees.ov.{${ids}}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Usuwa znaki specjalne dla ILIKE (%, _) oraz separatory PostgREST (,()) —
// szukamy dokładnego dopasowania (bez znaczenia wielkości liter), nie substringu.
function sanitizeForIlike(v: string): string {
  return v.replace(/[%_,()]/g, ' ').trim()
}

const DUP_SELECT = `id, adres,
  assignee:profiles!properties_assigned_to_fkey(id,full_name),
  creator:profiles!properties_created_by_fkey(id,full_name)`

interface DuplicateMatch {
  id: string
  assignee: { full_name: string } | { full_name: string }[] | null
  creator: { full_name: string } | { full_name: string }[] | null
}

function duplicateContactLabel(dup: DuplicateMatch): string {
  const assignee = Array.isArray(dup.assignee) ? dup.assignee[0] : dup.assignee
  const creator = Array.isArray(dup.creator) ? dup.creator[0] : dup.creator
  return assignee?.full_name || creator?.full_name || 'osobą przypisaną do nieruchomości'
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()

  // Wykrywanie duplikatów — agenci widzą tylko swoje nieruchomości, więc bez
  // tej kontroli mogliby niezależnie dodać tę samą nieruchomość dwa razy.
  const kwNumber = typeof body.kw_number === 'string' ? sanitizeForIlike(body.kw_number) : ''
  const adres = typeof body.adres === 'string' ? sanitizeForIlike(body.adres) : ''
  const kodPocztowy = typeof body.kod_pocztowy === 'string' ? sanitizeForIlike(body.kod_pocztowy) : ''
  const miasto = typeof body.miasto === 'string' ? sanitizeForIlike(body.miasto) : ''

  let duplicate: DuplicateMatch | null = null

  if (kwNumber) {
    const { data } = await supabase.from('properties').select(DUP_SELECT).ilike('kw_number', kwNumber).limit(1)
    duplicate = (data?.[0] as unknown as DuplicateMatch) ?? null
  }

  // Dopasowanie po adresie tylko gdy mamy wszystkie 3 pola — sam adres bez
  // miasta/kodu to za słaby sygnał (patrz np. placeholder z kalkulatora).
  if (!duplicate && adres && kodPocztowy && miasto) {
    const { data } = await supabase.from('properties').select(DUP_SELECT)
      .ilike('adres', adres).ilike('kod_pocztowy', kodPocztowy).ilike('miasto', miasto).limit(1)
    duplicate = (data?.[0] as unknown as DuplicateMatch) ?? null
  }

  if (duplicate) {
    return NextResponse.json({
      error: `Nieruchomość jest już w bazie, skontaktuj się z ${duplicateContactLabel(duplicate)} po więcej informacji`,
      duplicatePropertyId: duplicate.id,
    }, { status: 409 })
  }

  // Auto-geokodowanie przy tworzeniu (nieblokujące — brak współrzędnych to null)
  const coords = await geocodeAddress(body.adres, body.miasto ?? null, null)

  const { data: property, error } = await supabase
    .from('properties')
    .insert({ ...body, created_by: user.id, ...(coords ?? {}) })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_log').insert({
    property_id: property.id,
    user_id: user.id,
    action: 'created',
    details: { adres: property.adres, miasto: property.miasto },
  })

  return NextResponse.json(property, { status: 201 })
}
