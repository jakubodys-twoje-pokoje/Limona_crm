import type { SupabaseClient } from '@supabase/supabase-js'

interface TaskCardLinks {
  property_id?: string | null
  kontakt_id?: string | null
  lead_id?: string | null
  title?: string | null
}

/**
 * Kopiuje treść komentarza z zadania na powiązaną kartę (nieruchomość /
 * kontakt / lead), żeby aktywność ze sprawy była widoczna też na karcie i w
 * raporcie — bez ręcznego przeklejania. Dotyczy zwykłych komentarzy oraz
 * komentarzy przy zmianie statusu (np. domknięcie zadania z opisem).
 *
 * Best-effort: ewentualny błąd nie może wywrócić operacji na samym zadaniu.
 * Zwraca liczbę kart, na które trafił komentarz (0 = zadanie bez powiązań).
 */
export async function mirrorTaskCommentToCards(
  supabase: SupabaseClient,
  task: TaskCardLinks,
  content: string,
  userId: string,
): Promise<number> {
  const text = content?.trim()
  if (!text) return 0
  const prefix = task.title ? `[zadanie: ${task.title}] ` : '[zadanie] '
  const body = `${prefix}${text}`
  let mirrored = 0
  try {
    if (task.property_id) {
      await supabase.from('property_comments').insert({ property_id: task.property_id, user_id: userId, content: body })
      mirrored++
    }
    if (task.kontakt_id) {
      await supabase.from('kontakt_komentarze').insert({ kontakt_id: task.kontakt_id, user_id: userId, content: body })
      mirrored++
    }
    if (task.lead_id) {
      await supabase.from('lead_comments').insert({ lead_id: task.lead_id, user_id: userId, content: body })
      mirrored++
    }
  } catch {
    /* mirroring jest dodatkiem — nie wywracamy zapisu komentarza zadania */
  }
  return mirrored
}
