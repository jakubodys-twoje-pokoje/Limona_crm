import { cookies } from 'next/headers'

/**
 * „Podgląd jako użytkownik" — centrala (admin / kierownik centrali) może
 * przełączyć widok na wybranego użytkownika i zobaczyć aplikację dokładnie
 * tak, jak widzi ją ta osoba (te same filtry widoczności, menu i role).
 *
 * Zasady:
 *  - sesja Supabase NIE jest podmieniana — zalogowany zostaje kierownik,
 *    podmieniana jest tylko TOŻSAMOŚĆ EFEKTYWNA używana przez trasy API,
 *  - podgląd jest TYLKO DO ODCZYTU (zapisy blokuje proxy) — żeby żadna
 *    zmiana nie została zapisana „cudzą ręką",
 *  - ciasteczko zawiera też id oglądającego, więc po wylogowaniu i wejściu
 *    kogoś innego na tej samej przeglądarce podgląd nie zadziała.
 */
export const VIEW_AS_COOKIE = 'limona_view_as'

/** Ile trwa podgląd, zanim wygaśnie sam z siebie (8 h — jedna zmiana) */
export const VIEW_AS_MAX_AGE = 8 * 60 * 60

export interface ViewAsCookie {
  viewerId: string
  targetId: string
}

export function encodeViewAs(viewerId: string, targetId: string): string {
  return `${viewerId}:${targetId}`
}

export function parseViewAs(value: string | undefined): ViewAsCookie | null {
  if (!value) return null
  const [viewerId, targetId, ...rest] = value.split(':')
  if (!viewerId || !targetId || rest.length) return null
  return { viewerId, targetId }
}

/**
 * Id użytkownika, na którego przełączony jest podgląd — albo null.
 * Honorujemy ciasteczko wyłącznie, gdy PRAWDZIWA rola z bazy na to pozwala
 * i gdy ciasteczko zostało wystawione dla tej właśnie osoby; samo
 * ciasteczko niczego nie autoryzuje (klient może je podmienić).
 */
export async function getViewAsTargetId(realUserId: string, canViewAs: boolean): Promise<string | null> {
  if (!canViewAs) return null
  const store = await cookies()
  const parsed = parseViewAs(store.get(VIEW_AS_COOKIE)?.value)
  if (!parsed || parsed.viewerId !== realUserId) return null
  // Podgląd samego siebie to zwykła sesja
  return parsed.targetId === realUserId ? null : parsed.targetId
}
