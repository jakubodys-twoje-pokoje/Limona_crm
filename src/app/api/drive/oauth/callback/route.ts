export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/api-auth'
import { setSetting } from '@/lib/appSettings'

function backToAdmin(req: NextRequest, param: string) {
  return NextResponse.redirect(`${req.nextUrl.origin}/admin?drive=${param}`)
}

/**
 * GET /api/drive/oauth/callback — odbiera kod z Google, wymienia na
 * refresh token i zapisuje w app_settings. Wraca do panelu Admin.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') return backToAdmin(req, 'error_auth')

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieState = req.cookies.get('gdrive_oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) {
    return backToAdmin(req, 'error_state')
  }

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL || `${req.nextUrl.origin}/api/drive/oauth/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) return backToAdmin(req, 'error_token')

  const tokens = await tokenRes.json()
  if (!tokens.refresh_token) return backToAdmin(req, 'error_no_refresh')

  // email z id_token (tylko do wyświetlenia w panelu, nie do autoryzacji)
  let email = ''
  try {
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf-8'))
    email = payload.email || ''
  } catch { /* brak emaila to nie błąd */ }

  await setSetting('google_oauth_refresh_token', tokens.refresh_token)
  if (email) await setSetting('google_oauth_email', email)

  const res = backToAdmin(req, 'connected')
  res.cookies.delete('gdrive_oauth_state')
  return res
}
