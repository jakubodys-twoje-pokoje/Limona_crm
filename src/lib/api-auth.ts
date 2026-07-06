import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  avatar_url: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
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

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
