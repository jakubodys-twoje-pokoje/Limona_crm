export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canSeeAllTeams } from '@/lib/roles'
import { findDuplicateLead, duplicateAssigneeName } from '@/lib/lead-dedupe'
import { geocodeAddress } from '@/lib/geocode'
import { getUserGrants } from '@/lib/access'

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
  const temperature = searchParams.get('temperature')

  let query = supabase.from('leads').select(SELECT_WITH_RELATIONS).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (temperature) query = query.eq('temperature', temperature)

  // Zwykły user widzi swoje / przypisane leady + to, co odblokują granty
  // dostępu (cała kategoria „leady" znosi filtr, per-osoba dokłada właścicieli)
  if (!canSeeAllTeams(user.role)) {
    const grants = await getUserGrants(supabase, user.id)
    if (!grants.leady.all) {
      const ids = [...new Set([user.id, ...grants.leady.userIds])].join(',')
      query = query.or(`created_by.in.(${ids}),assigned_to.in.(${ids})`)
    }
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

  // Telefon/email są opcjonalne (temat z oszacowań bywa bez namiaru) —
  // ale bez nich nie zadziała deduplikacja, więc duplikaty pilnują się
  // tylko dla leadów z podanym kontaktem.
  // Deduplikacja — `force: true` pozwala świadomie dodać mimo ostrzeżenia
  if (!body.force && (body.phone?.trim() || body.email?.trim())) {
    const dup = await findDuplicateLead(body.phone || null, body.email || null)
    if (dup) {
      const assigneeName = duplicateAssigneeName(dup)
      return NextResponse.json({
        error: `Ten telefon/email już istnieje jako lead „${dup.name}"${assigneeName ? ` (prowadzi: ${assigneeName})` : ''}`,
        duplicateId: dup.id,
      }, { status: 409 })
    }
  }

  // Geokodowanie lokalizacji — lead pojawia się na mapie (nieblokujące)
  const coords = body.location ? await geocodeAddress(body.location, null, null) : null

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      location: body.location || null,
      ...(coords ?? {}),
      source: body.source || null,
      notes: body.notes || null,
      temperature: body.temperature || 'warm',
      next_contact_at: body.nextContactAt || null,
      status: 'new',
      assigned_to: body.assignedTo || null,
      created_by: user.id,
    })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom managerów/adminów + przypisanego agenta (service role — cudze powiadomienia)
  try {
    const admin = createAdminClient()
    const { data: managers } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager', 'kierownik_centrali'])
    const recipients = new Set((managers ?? []).map(m => m.id))
    if (body.assignedTo) recipients.add(body.assignedTo)
    recipients.delete(user.id)
    if (recipients.size > 0) {
      await admin.from('notifications').insert(
        [...recipients].map(id => ({
          user_id: id,
          from_user_id: user.id,
          type: 'new_lead',
          title: id === body.assignedTo ? 'Przypisano Ci nowego leada' : 'Nowy lead',
          body: `${body.name.trim()}${body.location ? ` — ${body.location}` : ''}`,
          link: '/leady',
          reference_id: lead.id,
        }))
      )
    }
  } catch { /* non-critical */ }

  return NextResponse.json(lead, { status: 201 })
}
