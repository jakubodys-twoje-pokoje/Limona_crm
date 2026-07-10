export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const BUCKET = 'kontakt-zdjecia'
const MAX_PHOTOS = 5
const MAX_SIZE = 8 * 1024 * 1024 // 8 MB

function extractStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: existing } = await supabase.from('kontakty').select('zdjecia').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const current: string[] = existing.zdjecia ?? []
  if (current.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Maksymalnie ${MAX_PHOTOS} zdjęć na kontakt` }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Dozwolone są tylko obrazy' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Plik za duży (max 8 MB)' }, { status: 400 })

  const ext = (file.type.split('/')[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${id}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const nextZdjecia = [...current, pub.publicUrl]

  const { data: kontakt, error } = await supabase
    .from('kontakty')
    .update({ zdjecia: nextZdjecia })
    .eq('id', id)
    .select('zdjecia')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(kontakt, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const { data: existing } = await supabase.from('kontakty').select('zdjecia').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const nextZdjecia = (existing.zdjecia ?? []).filter((u: string) => u !== url)

  const { data: kontakt, error } = await supabase
    .from('kontakty')
    .update({ zdjecia: nextZdjecia })
    .eq('id', id)
    .select('zdjecia')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const path = extractStoragePath(url)
  if (path) await supabase.storage.from(BUCKET).remove([path])

  return NextResponse.json(kontakt)
}
