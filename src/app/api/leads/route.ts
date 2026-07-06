export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canSeeAllTeams } from '@/lib/roles'

const SELECT_WITH_RELATIONS = `*,
  assignee:profiles!leads_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!leads_created_by_fkey(id,full_name,avatar_url)`

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')

  let query = supabase.from('leads').select(SELECT_WITH_RELATIONS).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  // Zwykły user widzi tylko swoje / przypisane leady
  if (!canSeeAllTeams(user.role)) {
    query = query.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Imię/nazwa jest wymagana' }, { status: 400 })
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: body.name.trim(),
      phone: body.phone || null,
      email: body.email || null,
      location: body.location || null,
      source: body.source || null,
      notes: body.notes || null,
      status: 'new',
      assigned_to: body.assignedTo || null,
      created_by: user.id,
    })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom managerów i adminów o nowym leadzie (service role — cudze powiadomienia)
  try {
    const admin = createAdminClient()
    const { data: managers } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager', 'kierownik_centrali'])
    const recipients = (managers ?? []).filter(m => m.id !== user.id)
    if (recipients.length > 0) {
      await admin.from('notifications').insert(
        recipients.map(m => ({
          user_id: m.id,
          from_user_id: user.id,
          type: 'new_lead',
          title: 'Nowy lead',
          body: `${body.name.trim()}${body.location ? ` — ${body.location}` : ''}`,
          link: '/leady',
          reference_id: lead.id,
        }))
      )
    }
  } catch { /* non-critical */ }

  return NextResponse.json(lead, { status: 201 })
}
