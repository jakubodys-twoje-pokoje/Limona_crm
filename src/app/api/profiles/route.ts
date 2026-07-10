export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, email, rejon, rejon_lat, rejon_lng, created_at, updated_at')
    .order('full_name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
