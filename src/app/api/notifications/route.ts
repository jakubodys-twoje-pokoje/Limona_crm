export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*, from_user:profiles!notifications_from_user_id_fkey(id,full_name,avatar_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: body.userId,
      from_user_id: body.fromUserId || user.id,
      type: body.type,
      title: body.title,
      body: body.body || null,
      link: body.link || null,
      reference_id: body.referenceId || null,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(notification, { status: 201 })
}
