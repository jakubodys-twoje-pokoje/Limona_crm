export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { getVisibleUserIds } from '@/lib/visibility'

/**
 * Zakres widoczności bieżącego użytkownika (null = wszyscy). Endpoint jest
 * INFORMACYJNY — służy UI do decyzji typu „czy pokazać filtr po agencie".
 * Trasy z danymi liczą ten sam zakres samodzielnie i nie ufają klientowi.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const visibleIds = await getVisibleUserIds(supabase, user.id, user.role)
  return NextResponse.json({ visibleIds })
}
