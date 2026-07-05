export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = createClient()

  const propertyId = req.nextUrl.searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('activity_log')
    .select('*, user:profiles!activity_log_user_id_fkey(id,full_name,avatar_url)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
