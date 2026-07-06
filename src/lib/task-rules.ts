interface TaskRuleFields {
  status?: string | null
  task_type?: string | null
  outcome?: string | null
  rejection_reason?: string | null
  rejection_note?: string | null
}

/**
 * Twarde reguły domykania zadań kontaktowych (źródłem prawdy jest API):
 *  - wizyta/telefon nie przechodzi w done bez outcome,
 *  - odmowa (niezainteresowany) wymaga powodu,
 *  - powód „inny" wymaga notatki.
 * Zwraca komunikat błędu (PL) albo null, gdy wszystko gra.
 */
export function validateTaskRules(t: TaskRuleFields): string | null {
  const isContactTask = t.task_type === 'wizyta' || t.task_type === 'telefon'

  if (t.status === 'done' && isContactTask && !t.outcome) {
    return 'Zadanie kontaktowe (wizyta/telefon) wymaga wyniku, żeby je domknąć'
  }
  if (t.outcome === 'niezainteresowany' && !t.rejection_reason) {
    return 'Przy odmowie wybierz powód (cena, timing, konkurencja...)'
  }
  if (t.outcome === 'niezainteresowany' && t.rejection_reason === 'inny' && !t.rejection_note?.trim()) {
    return 'Przy powodzie „Inny" dopisz krótką notatkę'
  }
  return null
}
