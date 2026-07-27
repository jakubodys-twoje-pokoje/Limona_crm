export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

// Otwarcie pliku: dla dokumentów wgranych do CRM (storage_path) generujemy
// krótkotrwały podpisany link do prywatnego bucketa i przekierowujemy — plik
// jest więc dostępny tylko dla zalogowanych userów, bez zależności od Google.
// Dla dokumentów będących zewnętrznym linkiem — przekierowanie na file_url.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, file_url')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  if (doc.storage_path) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300)
    if (error || !data) return NextResponse.json({ error: error?.message || 'Błąd pliku' }, { status: 500 })
    return NextResponse.redirect(data.signedUrl)
  }
  if (doc.file_url) return NextResponse.redirect(doc.file_url)
  return NextResponse.json({ error: 'Brak pliku' }, { status: 404 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: doc } = await supabase
    .from('documents')
    .select('id, uploaded_by, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  if (doc.uploaded_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  if (doc.storage_path) {
    await supabase.storage.from('documents').remove([doc.storage_path]).catch(() => {})
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
