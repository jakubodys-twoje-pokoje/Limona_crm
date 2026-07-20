export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { driveAuthMode, driveOAuthConnected } from '@/lib/drive'
import { getSetting, deleteSetting } from '@/lib/appSettings'

/** GET — status integracji Drive dla panelu Admin */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  const mode = driveAuthMode()
  const connected = mode === 'oauth' ? await driveOAuthConnected() : mode === 'sa'
  const email = mode === 'oauth' && connected ? await getSetting('google_oauth_email') : null

  return NextResponse.json({ mode, connected, email })
}

/** DELETE — rozłączenie konta Google (usuwa refresh token) */
export async function DELETE() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  await deleteSetting('google_oauth_refresh_token')
  await deleteSetting('google_oauth_email')
  // ID folderu-korzenia celowo zostaje — po ponownym połączeniu tego samego
  // konta struktura folderów podłącza się z powrotem bez duplikatów
  return NextResponse.json({ ok: true })
}
