import type { UserRole } from '@/types/database'

/**
 * Role z widocznością danych ponad własny zespół (teams/team_members):
 * manager widzi swój zespół + wszystko operacyjnie (istniejąca konwencja
 * tej apki — visibleIds=null dla managera), kierownik_centrali dodatkowo
 * widzi ewaluację wszystkich zespołów naraz, bez uprawnień admina do
 * zarządzania kontami.
 */
export function canSeeAllTeams(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'kierownik_centrali'
}

/**
 * Kto może zarządzać zespołami (tworzyć/usuwać zespoły, dodawać/usuwać
 * członków, ustawiać liderów). Celowo węższe niż canSeeAllTeams — zwykły
 * manager jest liderem konkretnego zespołu, a nie osobą zarządzającą
 * strukturą wszystkich zespołów.
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

/**
 * Dział prawny — konto obsługujące wyłącznie tor prawny: widzi Zadania
 * i Nieruchomości (w tym wszystkie zadania prawne), bez bazy kontaktów,
 * leadów, zespołów i panelu centrali.
 */
export function isDzialPrawny(role: UserRole | string | undefined): boolean {
  return role === 'dzial_prawny'
}

/**
 * Kto widzi wszystkie nieruchomości (bez filtra właściciela). Poza rolami
 * ponadzespołowymi także dział prawny — prowadzi sprawy prawne na cudzych
 * nieruchomościach, więc musi je otworzyć.
 */
export function canSeeAllProperties(role: UserRole | string | undefined): boolean {
  return canSeeAllTeams(role) || isDzialPrawny(role)
}

/**
 * Kto ma dostęp do bazy klienckiej (kontakty, leady). Dział prawny — nie:
 * jego dostęp kończy się na zadaniach i nieruchomościach.
 */
export function canSeeClientBase(role: UserRole | string | undefined): boolean {
  return !isDzialPrawny(role)
}

/** Ścieżki dostępne dla działu prawnego (reszta menu jest ukryta i zablokowana) */
const DZIAL_PRAWNY_PATHS = ['/zadania', '/nieruchomosci', '/profil']

/** Czy rola może wejść na daną ścieżkę aplikacji (bramka nawigacyjna) */
export function canAccessPath(role: UserRole | string | undefined, pathname: string): boolean {
  if (!isDzialPrawny(role)) return true
  return DZIAL_PRAWNY_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

/** Strona startowa roli — dział prawny nie ma dostępu do Dashboardu */
export function homePathForRole(role: UserRole | string | undefined): string {
  return isDzialPrawny(role) ? '/zadania' : '/dashboard'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  kierownik_centrali: 'Kierownik centrali',
  manager: 'Manager',
  dzial_prawny: 'Dział prawny',
  user: 'User',
  viewer: 'Viewer',
}
