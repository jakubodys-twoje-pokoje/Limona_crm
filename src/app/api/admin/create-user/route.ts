export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  const { email, password, fullName, role } = await req.json()
  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Wymagane: email, hasło, imię' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Ten email jest już zajęty' }, { status: 409 })
  }

  // Konto w auth.users; profil tworzy trigger on_auth_user_created
  // na podstawie user_metadata.
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: role || 'user' },
  })
  if (error) {
    const status = error.message.toLowerCase().includes('already') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json(
    { id: data.user.id, email, full_name: fullName },
    { status: 201 }
  )
}
