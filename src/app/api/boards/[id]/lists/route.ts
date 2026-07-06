export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })

  const { data: last } = await supabase
    .from('board_lists')
    .select('position')
    .eq('board_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const position = (last?.position ?? -1) + 1

  const { data: list, error } = await supabase
    .from('board_lists')
    .insert({ board_id: id, name: body.name.trim(), position })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(list, { status: 201 })
}
