export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { randomUUID } from 'node:crypto'

// Token feedu kalendarza bieżącego użytkownika (do zbudowania adresu w Profilu)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('calendar_token').eq('id', user.id).maybeSingle()
  return NextResponse.json({ token: data?.calendar_token ?? null })
}

// Wygeneruj nowy token — stary adres feedu przestaje działać (unieważnienie)
export async function POST() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const token = randomUUID()
  const { error } = await supabase.from('profiles').update({ calendar_token: token }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}
