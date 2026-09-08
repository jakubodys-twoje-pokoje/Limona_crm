export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, email, rejon, rejon_lat, rejon_lng, theme_preference, created_at, updated_at')
    .eq('id', user.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Przy podglądzie „jako użytkownik" zwracamy profil OGLĄDANEJ osoby (UI ma
  // wyglądać jak u niej) plus informację, kto naprawdę jest zalogowany —
  // z tego korzysta pasek podglądu i wyjście z trybu.
  return NextResponse.json({
    ...profile,
    view_as: user.viewAs
      ? { real_id: user.viewAs.realId, real_name: user.viewAs.realName, real_role: user.viewAs.realRole }
      : null,
  })
}
