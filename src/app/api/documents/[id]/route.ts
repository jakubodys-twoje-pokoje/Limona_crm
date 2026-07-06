export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: doc } = await supabase
    .from('documents')
    .select('id, uploaded_by')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  if (doc.uploaded_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.file_url?.trim()) updates.file_url = body.file_url.trim()
  if (body.file_type !== undefined) updates.file_type = body.file_type
  if (body.stage !== undefined) updates.stage = body.stage

  const { data: doc, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(doc)
}
