export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const BUCKET = 'documents'
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

/**
 * Wgranie pliku dokumentu do prywatnego bucketa 'documents'. Plik jest
 * dostępny wyłącznie zalogowanym userom CRM przez podpisany link
 * (GET /api/documents/[id]) — bez zależności od Google Drive.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const form = await req.formData()
  const file = form.get('file')
  const propertyId = form.get('property_id')
  const stage = form.get('stage')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
  if (typeof propertyId !== 'string' || !propertyId) return NextResponse.json({ error: 'property_id wymagane' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Plik za duży (max 25 MB)' }, { status: 400 })

  const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'plik'
  const path = `${propertyId}/${crypto.randomUUID()}-${safeName}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream' })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      property_id: propertyId,
      name: safeName,
      storage_path: path,
      file_url: null,
      file_type: file.type || null,
      stage: typeof stage === 'string' && stage ? stage : null,
      uploaded_by: user.id,
    })
    .select('*')
    .single()
  if (error) {
    // Sprzątanie osieroconego pliku, gdy wiersz się nie zapisał
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(doc, { status: 201 })
}
