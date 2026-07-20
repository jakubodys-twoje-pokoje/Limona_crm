import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Ustawienia/sekrety serwerowe w tabeli app_settings (service role only).
 * Używane m.in. przez integrację Google Drive (refresh token OAuth).
 */

export async function getSetting(key: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`app_settings upsert: ${error.message}`)
}

export async function deleteSetting(key: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('app_settings').delete().eq('key', key)
}
