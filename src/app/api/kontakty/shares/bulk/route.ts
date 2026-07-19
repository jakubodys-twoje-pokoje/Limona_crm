export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

// Zbiorcze udostępnienie: wszystkie kontakty z danego miasta (wybrane typy)
// trafiają do kontakt_shares wskazanego użytkownika — zamiast klikania
// po jednym. Np. „Kraków → Jan" i Jan widzi wszystkie krakowskie spółdzielnie.
// Uwaga: to jednorazowa operacja — kontakty dodane później trzeba
// udostępnić ponownie (wystarczy znów kliknąć to samo miasto).
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const body = await req.json()
  const userId: string | undefined = body.userId
  const miasto: string | undefined = body.miasto?.trim()
  const typy: string[] = Array.isArray(body.typy) && body.typy.length
    ? body.typy
    : ['spoldzielnia', 'wspolnota']

  if (!userId || !miasto) {
    return NextResponse.json({ error: 'userId i miasto są wymagane' }, { status: 400 })
  }
  // Inwestorzy to dane wrażliwe — nie podlegają zbiorczemu udostępnianiu
  if (typy.includes('inwestor')) {
    return NextResponse.json({ error: 'Kontaktów typu inwestor nie można udostępniać zbiorczo' }, { status: 400 })
  }

  const { data: kontakty, error: selectError } = await supabase
    .from('kontakty')
    .select('id, assigned_to')
    .ilike('miasto', miasto.replace(/[%_]/g, ' '))
    .in('typ', typy)
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 })

  // Własnych kontaktów nie trzeba nikomu udostępniać
  const toShare = (kontakty ?? []).filter(k => k.assigned_to !== userId)
  if (!toShare.length) {
    return NextResponse.json({ shared: 0, matched: kontakty?.length ?? 0 })
  }

  const { data: inserted, error } = await supabase
    .from('kontakt_shares')
    .upsert(
      toShare.map(k => ({ kontakt_id: k.id, shared_with_user_id: userId, created_by: user.id })),
      { onConflict: 'kontakt_id,shared_with_user_id', ignoreDuplicates: true }
    )
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shared: inserted?.length ?? 0, matched: kontakty?.length ?? 0 })
}
