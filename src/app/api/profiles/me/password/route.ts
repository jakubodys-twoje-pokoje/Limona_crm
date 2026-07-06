export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { newPassword } = await req.json()
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Hasło musi mieć minimum 6 znaków' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
