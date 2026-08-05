import type { UserRole } from '@/types/database'
import { canSeeAllTeams, canManageTeams } from '@/lib/roles'

/** Typy rekordów, które można zgłaszać do usunięcia */
export type DeletionEntityType = 'lead' | 'kontakt' | 'property'

export const DELETION_ENTITY_LABELS: Record<DeletionEntityType, string> = {
  lead: 'Lead',
  kontakt: 'Kontakt',
  property: 'Nieruchomość',
}

export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected'

/**
 * Kto usuwa rekordy WPROST (bez prośby): role z widocznością ponad zespół
 * (admin, manager, kierownik centrali). Zwykli użytkownicy (user/viewer)
 * zamiast tego zgłaszają prośbę o usunięcie.
 */
export function canDeleteRecords(role: UserRole | string | undefined): boolean {
  return canSeeAllTeams(role)
}

/** Kto rozpatruje prośby o usunięcie (centrala) — admin i kierownik centrali. */
export function canReviewDeletions(role: UserRole | string | undefined): boolean {
  return canManageTeams(role)
}
