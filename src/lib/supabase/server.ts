import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Klient serwerowy z sesją zalogowanego użytkownika (cookies).
 * Używany w API routes — wszystkie zapytania przechodzą przez RLS.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Wywołanie z Server Component bez możliwości zapisu cookies —
            // sesję odświeża middleware, więc można bezpiecznie zignorować.
          }
        },
      },
    }
  )
}
