export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findDuplicateLead } from '@/lib/lead-dedupe'

/**
 * Webhook przyjmujący leady z zewnątrz (n8n, formularze, landing page).
 *
 * Autoryzacja: nagłówek `Authorization: Bearer <LEADS_WEBHOOK_SECRET>`
 * albo `X-Webhook-Secret: <LEADS_WEBHOOK_SECRET>` (env po stronie serwera).
 *
 * Payload (JSON): {
 *   name: string          — wymagane
 *   phone?: string        — wymagany telefon LUB email
 *   email?: string
 *   location?: string
 *   source?: string       — np. "OLX", "landing", nazwa workflow w n8n
 *   notes?: string
 *   temperature?: 'hot' | 'warm' | 'cold'   — domyślnie 'warm'
 * }
 *
 * Deduplikacja: jeśli otwarty lead z tym numerem/emailem już istnieje,
 * NIE tworzymy drugiego — doklejamy komentarz "ponowne zgłoszenie" do
 * istniejącego i podbijamy licznik w meta. Odpowiedź zawsze mówi, co
 * się stało: { created: true, id } albo { created: false, duplicateOf }.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.LEADS_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook nie jest skonfigurowany (brak LEADS_WEBHOOK_SECRET)' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  const headerSecret = req.headers.get('x-webhook-secret')
  const provided = headerSecret || (auth?.startsWith('Bearer ') ? auth.slice(7) : null)
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!name) return NextResponse.json({ error: 'name jest wymagane' }, { status: 400 })
  if (!phone && !email) return NextResponse.json({ error: 'phone lub email jest wymagany' }, { status: 400 })

  const temperature = ['hot', 'warm', 'cold'].includes(body.temperature as string)
    ? (body.temperature as string)
    : 'warm'

  const admin = createAdminClient()

  // Duplikat → komentarz do istniejącego leada zamiast nowego rekordu
  const dup = await findDuplicateLead(phone || null, email || null)
  if (dup) {
    await admin.from('lead_comments').insert({
      lead_id: dup.id,
      user_id: null,
      content: `📥 Ponowne zgłoszenie z webhooka (${body.source || 'nieznane źródło'}) — ${name}${phone ? `, tel. ${phone}` : ''}${email ? `, ${email}` : ''}${body.notes ? `\n${body.notes}` : ''}`,
    })
    // Podbij licznik zgłoszeń w meta (audyt: ile razy ta osoba wracała)
    const { data: current } = await admin.from('leads').select('meta').eq('id', dup.id).single()
    const meta = (current?.meta as Record<string, unknown>) ?? {}
    const resubmissions = typeof meta.webhook_resubmissions === 'number' ? meta.webhook_resubmissions + 1 : 1
    await admin.from('leads').update({ meta: { ...meta, webhook_resubmissions: resubmissions } }).eq('id', dup.id)

    // Powiadom prowadzącego — ponowne zgłoszenie to gorący sygnał
    if (dup.assigned_to) {
      await admin.from('notifications').insert({
        user_id: dup.assigned_to,
        from_user_id: null,
        type: 'new_lead',
        title: 'Lead zgłosił się ponownie',
        body: `${dup.name} — kolejne zgłoszenie (${body.source || 'webhook'})`,
        link: '/leady',
        reference_id: dup.id,
      })
    }
    return NextResponse.json({ created: false, duplicateOf: dup.id })
  }

  const { data: lead, error } = await admin
    .from('leads')
    .insert({
      name,
      phone: phone || null,
      email: email || null,
      location: typeof body.location === 'string' ? body.location : null,
      source: typeof body.source === 'string' ? body.source : 'webhook',
      notes: typeof body.notes === 'string' ? body.notes : null,
      temperature,
      status: 'new',
      created_by: null,
      meta: { webhook: true, received_at: new Date().toISOString(), raw: body },
    })
    .select('id, name, location')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom managerów i adminów o nowym leadzie z webhooka
  try {
    const { data: managers } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager', 'kierownik_centrali'])
    if (managers?.length) {
      await admin.from('notifications').insert(
        managers.map(m => ({
          user_id: m.id,
          from_user_id: null,
          type: 'new_lead',
          title: `Nowy lead (${body.source || 'webhook'})`,
          body: `${lead.name}${lead.location ? ` — ${lead.location}` : ''}`,
          link: '/leady',
          reference_id: lead.id,
        }))
      )
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ created: true, id: lead.id }, { status: 201 })
}
