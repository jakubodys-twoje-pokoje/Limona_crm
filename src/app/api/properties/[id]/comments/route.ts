export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessProperty, recordNotFound } from '@/lib/record-access'
import { notifyCardActivity } from '@/lib/notify'
import { formatPropertyAddress } from '@/lib/utils'

const SELECT_WITH_USER = '*, user:profiles!property_comments_user_id_fkey(id,full_name,avatar_url)'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  const { data, error } = await supabase
    .from('property_comments')
    .select(SELECT_WITH_USER)
    .eq('property_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data: comment, error } = await supabase
    .from('property_comments')
    .insert({ property_id: id, user_id: user.id, content: content.trim() })
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: property } = await supabase
    .from('properties')
    .select('adres, kod_pocztowy, miasto, assigned_to, created_by, co_assignees')
    .eq('id', id)
    .maybeSingle()
  if (property) {
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [property.assigned_to, property.created_by, ...(property.co_assignees ?? [])],
      type: 'card_comment',
      title: 'Komentarz w nieruchomości',
      body: `${user.name} — ${formatPropertyAddress(property)}: ${content.trim().slice(0, 120)}`,
      link: `/nieruchomosci/${id}`,
      referenceId: id,
    })
  }

  return NextResponse.json(comment, { status: 201 })
}
