export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildIcs, type IcsTask } from '@/lib/ics'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Publiczny feed ICS zadań użytkownika — bez sesji; autoryzacja tajnym tokenem
// w adresie (kalendarz Google/Apple pobiera go swoim serwerem, bez cookies).
// Zwracamy tylko zadania właściciela tokenu.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = raw.replace(/\.ics$/i, '') // pozwól na /api/calendar/<token>.ics
  if (!UUID_RE.test(token)) return new NextResponse('Not found', { status: 404 })

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('calendar_token', token)
    .maybeSingle()
  if (!profile) return new NextResponse('Not found', { status: 404 })

  // Zadania z terminem: przypisane do usera lub gdzie jest współwykonawcą.
  // Okno: od 90 dni wstecz w przyszłość — feed nie puchnie w nieskończoność.
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_date, due_time, property:properties!tasks_property_id_fkey(adres,kod_pocztowy,miasto), kontakt:kontakty!tasks_kontakt_id_fkey(nazwa), lead:leads!tasks_lead_id_fkey(name)')
    .not('due_date', 'is', null)
    .gte('due_date', cutoff)
    .or(`assigned_to.eq.${profile.id},co_assignees.cs.{${profile.id}}`)
    .order('due_date', { ascending: true })

  const origin = req.nextUrl.origin
  const ics = buildIcs((tasks ?? []) as unknown as IcsTask[], `Limona — ${profile.full_name}`, origin)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="limona.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  })
}
