import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Role „kierownika" — osoby, które mają dostawać powiadomienia o zmianach i
 * komentarzach na WSZYSTKICH kartach (żeby śledzić aktywność z poziomu fx
 * Powiadomienia, bez przeglądania każdej karty osobno).
 */
const OVERSIGHT_ROLES = ['admin', 'kierownik_centrali', 'manager']

export type CardActivityType = 'card_change' | 'card_comment'

interface CardActivityParams {
  /** Kto wykonał akcję — wykluczony z odbiorców */
  actorId: string
  /** Osoby powiązane z kartą (wykonawca, współwykonawcy, twórca itd.) */
  linkedUserIds?: (string | null | undefined)[]
  type: CardActivityType
  title: string
  body?: string | null
  link?: string | null
  referenceId?: string | null
}

/**
 * Tworzy powiadomienia o aktywności na karcie dla kierownictwa oraz osób
 * powiązanych z kartą (bez autora akcji, bez duplikatów). Zaprojektowane do
 * użycia po stronie serwera (trasy API), więc pisze wprost do tabeli.
 * Błędy są łykane — powiadomienia nie mogą wywrócić głównej operacji.
 */
export async function notifyCardActivity(
  supabase: SupabaseClient,
  { actorId, linkedUserIds = [], type, title, body = null, link = null, referenceId = null }: CardActivityParams,
): Promise<void> {
  try {
    const recipients = new Set<string>()

    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', OVERSIGHT_ROLES)
    for (const m of managers ?? []) recipients.add(m.id as string)

    for (const id of linkedUserIds) if (id) recipients.add(id)

    recipients.delete(actorId)
    if (recipients.size === 0) return

    const rows = [...recipients].map(uid => ({
      user_id: uid,
      from_user_id: actorId,
      type,
      title,
      body,
      link,
      reference_id: referenceId,
    }))
    await supabase.from('notifications').insert(rows)
  } catch {
    /* powiadomienia są best-effort — nie wywracamy operacji głównej */
  }
}
