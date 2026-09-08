import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canViewAsUser } from '@/lib/roles'
import { getViewAsTargetId } from '@/lib/impersonation'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  avatar_url: string | null
  /** Ustawione, gdy centrala ogląda aplikację „jako" ten użytkownik (tylko odczyt) */
  viewAs?: {
    realId: string
    realName: string
    realRole: string
  }
}

/**
 * Prawdziwie zalogowany użytkownik — bez uwzględnienia podglądu „jako".
 * Tego używają trasy sterujące samym podglądem, żeby kierownik nie stracił
 * kontroli nad przełącznikiem po wejściu w cudzy widok.
 */
export async function getRealSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Rola i dane profilu zawsze z bazy (źródło prawdy), nie z JWT.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.full_name,
    role: profile.role,
    avatar_url: profile.avatar_url,
  }
}

/**
 * Tożsamość efektywna dla tras API. Zwykle to zalogowany użytkownik; przy
 * włączonym podglądzie „jako" (centrala) — dane oglądanej osoby, dzięki
 * czemu wszystkie filtry widoczności działają jak u niej. Zapisy w tym
 * trybie blokuje proxy, więc podmiana tożsamości nie może nic nadpisać.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const real = await getRealSessionUser()
  if (!real) return null

  const targetId = await getViewAsTargetId(real.id, canViewAsUser(real.role))
  if (!targetId) return real

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url')
    .eq('id', targetId)
    .maybeSingle()
  // Konto zniknęło (usunięte w międzyczasie) — wracamy do własnej tożsamości
  if (!target) return real

  return {
    id: target.id,
    email: target.email ?? '',
    name: target.full_name,
    role: target.role,
    avatar_url: target.avatar_url,
    viewAs: { realId: real.id, realName: real.name, realRole: real.role },
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
