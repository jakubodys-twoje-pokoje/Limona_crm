export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_LISTS = '*, lists:board_lists(*)'

function sortLists<T extends { lists?: { position: number }[] }>(board: T): T {
  if (board.lists) board.lists.sort((a, b) => a.position - b.position)
  return board
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('boards')
    .select(SELECT_WITH_LISTS)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(sortLists))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })

  const { data: board, error } = await supabase
    .from('boards')
    .insert({
      name: body.name.trim(),
      color: body.color || '#84cc16',
      description: body.description || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const listNames: string[] = Array.isArray(body.lists) ? body.lists : ['Do zrobienia', 'W toku', 'Gotowe']
  await supabase.from('board_lists').insert(
    listNames.map((name, i) => ({ board_id: board.id, name, position: i }))
  )

  const { data: full } = await supabase
    .from('boards')
    .select(SELECT_WITH_LISTS)
    .eq('id', board.id)
    .single()

  return NextResponse.json(full ? sortLists(full) : null, { status: 201 })
}
