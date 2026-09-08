import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Odświeżenie sesji Supabase w middleware — jedyne miejsce, które
 * może zapisać odświeżone tokeny do cookies przy żądaniach do
 * Server Components. Nie robi redirectów (ochrona tras pozostaje
 * w aplikacji, jak przed migracją).
 *
 * Zwraca też id zalogowanego użytkownika — proxy sprawdza po nim, czy
 * ciasteczko podglądu „jako" należy do tej sesji.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Nie usuwać: getUser() odświeża wygasły token i zapisuje go w cookies.
  const { data: { user } } = await supabase.auth.getUser()

  return { response, userId: user?.id ?? null }
}
