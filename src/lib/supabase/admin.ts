import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Klient z service role — OMIJA RLS.
 * Wyłącznie do operacji administracyjnych na kontach (auth.admin.*)
 * i skryptów/cronów. Nigdy nie używaj go do zapytań w imieniu
 * zalogowanego użytkownika.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
