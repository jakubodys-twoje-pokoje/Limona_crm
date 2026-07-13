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

  const { status, offer_amount } = await req.json()
  if (status === undefined && offer_amount === undefined) {
    return NextResponse.json({ error: 'status or offer_amount required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (status !== undefined) updates.status = status
  if (offer_amount !== undefined) updates.offer_amount = offer_amount === '' ? null : offer_amount

  const { error } = await supabase.from('property_investors').update(updates).eq('id', investorId)
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
