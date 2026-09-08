export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getRealSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canViewAsUser } from '@/lib/roles'
import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE, encodeViewAs, getViewAsTargetId } from '@/lib/impersonation'

/** Stan podglądu — kogo aktualnie ogląda zalogowana osoba */
export async function GET() {
  const real = await getRealSessionUser()
  if (!real) return unauthorized()

  const targetId = await getViewAsTargetId(real.id, canViewAsUser(real.role))
  if (!targetId) return NextResponse.json({ active: false, target: null })

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', targetId)
    .maybeSingle()
  return NextResponse.json({ active: !!target, target: target ?? null })
}

/** Włącza podgląd jako wskazany użytkownik (tylko do odczytu) */
export async function POST(req: NextRequest) {
  // Świadomie prawdziwa tożsamość — inaczej po wejściu w cudzy widok
  // kierownik nie mógłby się już przełączyć ani wrócić do siebie.
  const real = await getRealSessionUser()
  if (!real) return unauthorized()
  if (!canViewAsUser(real.role)) return forbidden()

  const { userId } = await req.json()
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'Podaj użytkownika do podglądu' }, { status: 400 })
  }
  if (userId === real.id) {
    return NextResponse.json({ error: 'To Twoje konto — podgląd nie jest potrzebny' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'Nie ma takiego użytkownika' }, { status: 404 })

  const store = await cookies()
  store.set(VIEW_AS_COOKIE, encodeViewAs(real.id, target.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VIEW_AS_MAX_AGE,
  })

  return NextResponse.json({ active: true, target })
}

/** Wyjście z podglądu — powrót na własne konto */
export async function DELETE() {
  const real = await getRealSessionUser()
  if (!real) return unauthorized()

  const store = await cookies()
  store.delete(VIEW_AS_COOKIE)
  return NextResponse.json({ active: false, target: null })
}
