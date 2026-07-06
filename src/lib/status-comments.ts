import type { LeadStatus, TaskStatus } from '@/types/database'

// Etykiety do formatowania wpisu w wątku komentarzy przy zmianie statusu
// (używane po stronie API przy budowaniu treści komentarza i po stronie
// UI przy pytaniu "dlaczego?").
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  done: 'Zrobione',
  blocked: 'Zablokowane',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nowy',
  contacted: 'Skontaktowany',
  qualified: 'Kwalifikowany',
  assigned: 'Przypisany',
  converted: 'Konwertowany',
  rejected: 'Odrzucony',
}

export function formatStatusChangeComment(newStatusLabel: string, comment: string): string {
  return `🔄 Status → ${newStatusLabel}\n${comment.trim()}`
}

export function formatFlagChangeComment(flagLabel: string, newValue: boolean, comment: string): string {
  return `🔄 ${flagLabel} → ${newValue ? 'tak' : 'nie'}\n${comment.trim()}`
}
