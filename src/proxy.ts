import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { VIEW_AS_COOKIE, parseViewAs } from '@/lib/impersonation'

/** Metody, które coś zmieniają — w podglądzie „jako użytkownik" zablokowane */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)

  const viewAs = parseViewAs(request.cookies.get(VIEW_AS_COOKIE)?.value)
  if (!viewAs) return response

  // Ciasteczko po innej sesji (ktoś wylogował się w trakcie podglądu, a na
  // tej przeglądarce zalogował się kto inny) — sprzątamy je, żeby nie
  // blokowało pracy komuś, kogo podgląd w ogóle nie dotyczy.
  if (!userId || viewAs.viewerId !== userId) {
    response.cookies.delete(VIEW_AS_COOKIE)
    return response
  }

  // Podgląd jako użytkownik jest tylko do odczytu: gdyby przepuścić zapis,
  // zostałby zapisany jako zmiana oglądanej osoby. Blokujemy w jednym
  // miejscu (wszystkie dane idą przez trasy API), z wyjątkiem samego
  // przełącznika podglądu — inaczej nie dałoby się z niego wyjść.
  const { pathname } = request.nextUrl
  if (
    WRITE_METHODS.has(request.method) &&
    pathname.startsWith('/api/') &&
    pathname !== '/api/impersonate'
  ) {
    const blocked = NextResponse.json(
      { error: 'Podgląd jako użytkownik jest tylko do odczytu — wróć na swoje konto, żeby wprowadzać zmiany' },
      { status: 403 },
    )
    // Przenosimy odświeżone tokeny sesji, żeby blokada zapisu nie kosztowała
    // użytkownika wylogowania.
    for (const cookie of response.cookies.getAll()) {
      blocked.cookies.set(cookie.name, cookie.value, cookie)
    }
    return blocked
  }

  return response
}

export const config = {
  matcher: [
    // Wszystko poza statykami — sesja musi się odświeżać także przy API.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
