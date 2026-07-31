export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { getUserGrants } from '@/lib/access'

// GET — granty bieżącego użytkownika (do odblokowania sekcji w UI)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const grants = await getUserGrants(supabase, user.id)
  return NextResponse.json(grants)
}
