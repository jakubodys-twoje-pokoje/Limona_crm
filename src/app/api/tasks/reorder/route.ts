export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

// Zapis ręcznej kolejności zadań całodniowych z Terminarza. Przyjmujemy listę
// { id, sort_order } dla jednego dnia (kilka zadań) i zapisujemy hurtem —
// dzięki temu jeden ruch w górę/dół to jedno żądanie i jedno odświeżenie.
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { orders } = await req.json()
  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: 'orders required' }, { status: 400 })
  }

  for (const o of orders) {
    if (!o?.id || typeof o.sort_order !== 'number') continue
    const { error } = await supabase.from('tasks').update({ sort_order: o.sort_order }).eq('id', o.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
