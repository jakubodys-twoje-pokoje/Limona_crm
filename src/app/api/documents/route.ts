export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessProperty, recordNotFound } from '@/lib/record-access'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const propertyId = req.nextUrl.searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })
  // Dokumenty należą do karty nieruchomości — dostęp jak do niej samej
  if (!(await canAccessProperty(supabase, user, propertyId))) return recordNotFound()

  const { data: docs, error } = await supabase
    .from('documents')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Doklej uploadera (brak FK documents→profiles w schemacie)
  const uploaderIds = Array.from(new Set((docs ?? []).map(d => d.uploaded_by).filter(Boolean))) as string[]
  let uploaderMap: Record<string, unknown> = {}
  if (uploaderIds.length) {
    const { data: uploaders } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', uploaderIds)
    uploaderMap = Object.fromEntries((uploaders ?? []).map(u => [u.id, u]))
  }

  const result = (docs ?? []).map(d => ({
    ...d,
    uploader: d.uploaded_by ? uploaderMap[d.uploaded_by] ?? null : null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { property_id, name, file_url, file_type, stage } = await req.json()
  if (!property_id || !name?.trim() || !file_url?.trim()) {
    return NextResponse.json({ error: 'property_id, name i file_url są wymagane' }, { status: 400 })
  }
  if (!(await canAccessProperty(supabase, user, property_id))) return recordNotFound()

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      property_id,
      name: name.trim(),
      file_url: file_url.trim(),
      file_type: file_type || null,
      stage: stage || null,
      uploaded_by: user.id,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(doc, { status: 201 })
}
