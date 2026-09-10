export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessKontakt, recordNotFound } from '@/lib/record-access'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; shareId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id, shareId } = await params
  if (!(await canAccessKontakt(supabase, user, id))) return recordNotFound()

  // Udostępnienie musi należeć do tego kontaktu — inaczej po id dałoby się
  // skasować cudze udostępnienie z zupełnie innej karty.
  const { error } = await supabase.from('kontakt_shares').delete().eq('id', shareId).eq('kontakt_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
