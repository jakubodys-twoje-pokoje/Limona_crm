export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { messageId } = await req.json()

  const { error } = await supabase
    .from('wall_reads')
    .upsert(
      { user_id: user.id, message_id: messageId },
      { onConflict: 'user_id,message_id', ignoreDuplicates: true }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
