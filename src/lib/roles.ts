import type { UserRole } from '@/types/database'

/**
 * Role z widocznością danych ponad własny zespół (team_visibility):
 * manager widzi swój zespół + wszystko operacyjnie (istniejąca konwencja
 * tej apki — visibleIds=null dla managera), kierownik_centrali dodatkowo
 * widzi ewaluację wszystkich zespołów naraz, bez uprawnień admina do
 * zarządzania kontami.
 */
export function canSeeAllTeams(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'kierownik_centrali'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  kierownik_centrali: 'Kierownik centrali',
  manager: 'Manager',
  user: 'User',
  viewer: 'Viewer',
}
