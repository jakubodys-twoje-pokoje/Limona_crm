export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const { error } = await supabase.from('wall_messages').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('wall_messages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
