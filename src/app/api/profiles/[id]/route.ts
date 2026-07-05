export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Only self or admin
  if (user.id !== params.id && user.role !== 'admin') return forbidden()

  const body = await req.json()
  // Don't allow changing password or email via this route
  delete body.password
  delete body.email
  // Zmiana roli tylko dla admina (RLS pilnuje tego samego w bazie)
  if (body.role !== undefined && user.role !== 'admin') return forbidden()

  const supabase = createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', params.id)
    .select('id, full_name, avatar_url, role, email, created_at, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(profile)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  if (user.id === params.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  // Usunięcie konta w auth.users kaskadowo usuwa profil (FK).
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
