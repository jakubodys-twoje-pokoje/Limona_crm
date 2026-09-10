import type { SupabaseClient } from '@supabase/supabase-js'
import { canSeeAllTeams } from '@/lib/roles'

/**
 * Kogo „widzi" użytkownik w danych operacyjnych:
 *  - null            → wszystkich (role ponadzespołowe: admin, manager, centrala),
 *  - lista id        → on sam + członkowie zespołów, w których jest liderem.
 *
 * Liczone ZAWSZE po stronie serwera. Wcześniej zakres widoczności przychodził
 * parametrem `visibleIds` od klienta, więc każdy ekran, który zapomniał go
 * dołożyć (np. Mapa), pokazywał całą bazę. Teraz parametr od klienta nie ma
 * znaczenia — o zakresie decyduje rola i przypisania w bazie.
 */
export async function getVisibleUserIds(
  supabase: SupabaseClient,
  userId: string,
  role: string | undefined,
): Promise<string[] | null> {
  if (canSeeAllTeams(role)) return null

  const { data: leadRows } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_lead', true)

  const teamIds = (leadRows ?? []).map(r => r.team_id as string)
  let memberIds: string[] = []
  if (teamIds.length) {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .in('team_id', teamIds)
    memberIds = (members ?? []).map(m => m.user_id as string)
  }

  return [...new Set([userId, ...memberIds])]
}
