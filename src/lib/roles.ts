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

/**
 * Kto może zarządzać regułami team_visibility (tworzyć/usuwać przypisania
 * manager↔członek). Celowo węższe niż canSeeAllTeams — zwykły manager jest
 * podmiotem tych reguł, a nie osobą je układającą.
 */
export function canManageTeams(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'kierownik_centrali'
}

/**
 * Kto widzi inwestorów (kontakty typu 'inwestor' + zakładkę Inwestorzy na
 * nieruchomości) — dane wrażliwe handlowo, tylko centrala i admini.
 */
export function canSeeInvestors(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'kierownik_centrali'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  kierownik_centrali: 'Kierownik centrali',
  manager: 'Manager',
  user: 'User',
  viewer: 'Viewer',
}
