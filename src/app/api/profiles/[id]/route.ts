export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const { id } = await params

  // Only self or admin
  if (user.id !== id && user.role !== 'admin') return forbidden()

  const body = await req.json()
  // Don't allow changing password or email via this route
  delete body.password
  delete body.email
  // Zmiana roli tylko dla admina (RLS pilnuje tego samego w bazie)
  if (body.role !== undefined && user.role !== 'admin') return forbidden()

  // Rejon zmienił się — dogeokoduj
  if (typeof body.rejon === 'string') {
    const coords = body.rejon.trim() ? await geocodeAddress(null, body.rejon.trim(), null) : null
    body.rejon = body.rejon.trim() || null
    body.rejon_lat = coords?.lat ?? null
    body.rejon_lng = coords?.lng ?? null
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', id)
    .select('id, full_name, avatar_url, role, email, rejon, rejon_lat, rejon_lng, created_at, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(profile)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  const { id } = await params
  if (user.id === id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  // Usunięcie konta w auth.users kaskadowo usuwa profil (FK).
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
