export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canSeeInvestors } from '@/lib/roles'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; investorId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canSeeInvestors(user.role)) return forbidden()
  const supabase = await createClient()
  const { investorId } = await params

  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const { error } = await supabase.from('property_investors').update({ status }).eq('id', investorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; investorId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canSeeInvestors(user.role)) return forbidden()
  const supabase = await createClient()
  const { investorId } = await params

  const { error } = await supabase.from('property_investors').delete().eq('id', investorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
