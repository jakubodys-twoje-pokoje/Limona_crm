export const dynamic = 'force-dynamic'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

/**
 * GET /api/drive/oauth/start — początek łączenia konta Google (admin).
 * Przekierowuje na ekran zgody Google; wynik odbiera /api/drive/oauth/callback.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Brak GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET w env' }, { status: 400 })
  }

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL || `${req.nextUrl.origin}/api/drive/oauth/callback`
  const state = crypto.randomBytes(16).toString('hex')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  // drive.file — CRM widzi tylko foldery/pliki, które sam utworzył;
  // openid email — żeby pokazać w panelu, które konto jest połączone
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file openid email')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url)
  res.cookies.set('gdrive_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', maxAge: 600, path: '/',
  })
  return res
}
