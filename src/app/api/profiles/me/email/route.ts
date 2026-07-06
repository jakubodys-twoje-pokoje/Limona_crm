export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Check if email taken
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Ten email jest już zajęty' }, { status: 409 })
  }

  // Email zmieniany w auth.users przez admin API (bez maila potwierdzającego,
  // jak przed migracją); trigger w bazie synchronizuje profiles.email.
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
