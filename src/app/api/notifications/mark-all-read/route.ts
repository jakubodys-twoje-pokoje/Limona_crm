export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
