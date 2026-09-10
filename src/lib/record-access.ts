import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canSeeAllTeams, canSeeAllProperties, isDzialPrawny } from '@/lib/roles'
import { getUserGrants, userCanSeeInvestors } from '@/lib/access'
import { getVisibleUserIds } from '@/lib/visibility'

/**
 * Dostęp do KONKRETNEGO rekordu — jedna reguła dla odczytu i dla zapisu:
 * czego user nie widzi na liście, tego nie otworzy ani nie zmieni, nawet
 * wołając trasę API wprost (adresem/skryptem). Podzasoby karty (komentarze,
 * dokumenty, negocjacje, zdjęcia, geokodowanie…) pytają o dostęp do karty
 * nadrzędnej, więc nie da się ich użyć jako bocznego wejścia.
 */

/** Kto pyta — tylko to, co potrzebne do decyzji (bez zależności od api-auth) */
export interface AccessUser {
  id: string
  role: string
}

/** Odpowiedź dla rekordu poza zakresem — 404, żeby nie zdradzać, że istnieje */
export function recordNotFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Czy user ma na tej nieruchomości własne zadanie (prowadzi je lub jest dopisany) */
async function hasOwnTaskOnProperty(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('property_id', propertyId)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId},co_assignees.ov.{${userId}}`)
    .limit(1)
  return !!data?.length
}

/**
 * Nieruchomość: centrala i dział prawny widzą wszystko; pozostali swoje
 * karty (dodane, prowadzone, współprowadzone), to co odblokuje panel
 * dostępów, oraz karty, na których mają własne zadanie — inaczej urwałyby
 * się linki z listy zadań (np. zadanie prawne na cudzej nieruchomości).
 */
export async function canAccessProperty(
  supabase: SupabaseClient,
  user: AccessUser,
  propertyId: string | null | undefined,
): Promise<boolean> {
  if (!propertyId) return false
  if (canSeeAllProperties(user.role)) return true

  const { data: property } = await supabase
    .from('properties')
    .select('assigned_to, created_by, co_assignees')
    .eq('id', propertyId)
    .maybeSingle()
  if (!property) return false

  const grants = await getUserGrants(supabase, user.id)
  if (grants.nieruchomosci.all) return true

  const owners = [property.assigned_to, property.created_by, ...((property.co_assignees as string[] | null) ?? [])]
    .filter((v): v is string => !!v)
  if (owners.includes(user.id)) return true
  if (owners.some(o => grants.nieruchomosci.userIds.includes(o))) return true

  return hasOwnTaskOnProperty(supabase, propertyId, user.id)
}

/**
 * Kontakt: role ponadzespołowe widzą wszystko; pozostali swoje kontakty
 * (i kontakty zespołu, jeśli są liderami), kontakty udostępnione im wprost
 * oraz odblokowane grantem na dany typ. Inwestorzy dodatkowo tylko dla tych,
 * którzy w ogóle mogą ich widzieć.
 */
export async function canAccessKontakt(
  supabase: SupabaseClient,
  user: AccessUser,
  kontaktId: string | null | undefined,
): Promise<boolean> {
  if (!kontaktId) return false

  const { data: kontakt } = await supabase
    .from('kontakty')
    .select('id, typ, assigned_to, created_by')
    .eq('id', kontaktId)
    .maybeSingle()
  if (!kontakt) return false

  if (kontakt.typ === 'inwestor' && !(await userCanSeeInvestors(supabase, user.id, user.role))) return false
  if (canSeeAllTeams(user.role)) return true

  const visibleIds = await getVisibleUserIds(supabase, user.id, user.role)
  const owners = [kontakt.assigned_to, kontakt.created_by].filter((v): v is string => !!v)
  if (visibleIds && owners.some(id => visibleIds.includes(id))) return true

  const grants = await getUserGrants(supabase, user.id)
  const g = grants.kontaktTypes[kontakt.typ as keyof typeof grants.kontaktTypes]
  if (g && (g.all || owners.some(id => g.userIds.includes(id)))) return true

  const { data: share } = await supabase
    .from('kontakt_shares')
    .select('id')
    .eq('kontakt_id', kontaktId)
    .eq('shared_with_user_id', user.id)
    .maybeSingle()
  return !!share
}

/**
 * Lead: role ponadzespołowe widzą wszystko; pozostali swoje (prowadzone,
 * dodane, współprowadzone) oraz odblokowane grantem na leady — dokładnie
 * ten sam zakres, co lista leadów.
 */
export async function canAccessLead(
  supabase: SupabaseClient,
  user: AccessUser,
  leadId: string | null | undefined,
): Promise<boolean> {
  if (!leadId) return false
  if (canSeeAllTeams(user.role)) return true

  const { data: lead } = await supabase
    .from('leads')
    .select('assigned_to, created_by, co_assignees')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead) return false

  const grants = await getUserGrants(supabase, user.id)
  if (grants.leady.all) return true

  const owners = [lead.assigned_to, lead.created_by, ...((lead.co_assignees as string[] | null) ?? [])]
    .filter((v): v is string => !!v)
  return owners.includes(user.id) || owners.some(o => grants.leady.userIds.includes(o))
}

/**
 * Zadanie: role ponadzespołowe widzą wszystkie; dział prawny dodatkowo
 * wszystkie zadania prawne; pozostali te, które prowadzą, założyli albo w
 * których są współwykonawcami (lider zespołu — także zadania swojego
 * zespołu). Ten sam zakres, co lista zadań.
 */
export async function canAccessTask(
  supabase: SupabaseClient,
  user: AccessUser,
  taskId: string | null | undefined,
): Promise<boolean> {
  if (!taskId) return false
  if (canSeeAllTeams(user.role)) return true

  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, created_by, co_assignees, task_kind')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return false

  if (task.task_kind === 'prawne' && isDzialPrawny(user.role)) return true

  const owners = [task.assigned_to, task.created_by, ...((task.co_assignees as string[] | null) ?? [])]
    .filter((v): v is string => !!v)
  if (owners.includes(user.id)) return true

  const visibleIds = await getVisibleUserIds(supabase, user.id, user.role)
  return !!visibleIds && owners.some(o => visibleIds.includes(o))
}

/**
 * Dostęp do rekordu po typie encji — używane tam, gdzie trasa obsługuje
 * kilka rodzajów kart naraz (np. foldery Google Drive).
 */
export async function canAccessEntity(
  supabase: SupabaseClient,
  user: AccessUser,
  entity: 'property' | 'kontakt' | 'lead' | string,
  recordId: string,
): Promise<boolean> {
  if (entity === 'property') return canAccessProperty(supabase, user, recordId)
  if (entity === 'kontakt') return canAccessKontakt(supabase, user, recordId)
  if (entity === 'lead') return canAccessLead(supabase, user, recordId)
  return false
}
