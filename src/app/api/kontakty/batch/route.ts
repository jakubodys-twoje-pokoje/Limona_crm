export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

// Pola dozwolone w edycji zbiorczej — świadomie wąska lista (dane
// adresowo-porządkowe). Treści (opis, komentarze, statusy decyzyjne)
// zmienia się tylko pojedynczo, z pełnym kontekstem.
const ALLOWED_FIELDS = ['miasto', 'wojewodztwo', 'typ', 'rozmiar', 'oddzial', 'assigned_to'] as const

const MAX_BATCH = 1000

/**
 * Zbiorcza edycja kontaktów — TYLKO admin.
 * Body: { ids: string[], updates: { miasto?, wojewodztwo?, typ?, rozmiar?, oddzial?, assigned_to? } }
 * Wartość '' (pusty string) czyści pole (ustawia NULL); pole nieobecne = bez zmian.
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  const supabase = await createClient()

  const body = await req.json()
  const ids: unknown = body.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'ids: niepusta lista identyfikatorów' }, { status: 400 })
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maksymalnie ${MAX_BATCH} kontaktów naraz` }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (body.updates?.[field] !== undefined) {
      updates[field] = body.updates[field] === '' ? null : body.updates[field]
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak pól do zmiany' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('kontakty')
    .update(updates)
    .in('id', ids)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: data?.length ?? 0 })
}
