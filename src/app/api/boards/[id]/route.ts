export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: board } = await supabase
    .from('boards')
    .select('*, lists:board_lists(*)')
    .eq('id', id)
    .maybeSingle()
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lists = (board.lists ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position)
  return NextResponse.json({ board, lists })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const f of ['name', 'color', 'description'] as const) {
    if (body[f] !== undefined) updates[f] = body[f]
  }

  const { data: board, error } = await supabase
    .from('boards')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(board)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  // tasks.board_id → null (FK on delete set null)
  const { error } = await supabase.from('boards').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
