import type { SupabaseClient } from '@supabase/supabase-js'
import { KONTAKT_TYPY, KONTAKT_TYP_LABELS } from '@/types/database'
import type { KontaktTyp } from '@/types/database'

// ---------------------------------------------------------------
// Zakresy grantów: nieruchomości, leady, kontakty per typ
// ---------------------------------------------------------------
export type AccessScope = 'nieruchomosci' | 'leady' | `kontakt:${KontaktTyp}`

export const ACCESS_SCOPES: AccessScope[] = [
  'nieruchomosci',
  'leady',
  ...KONTAKT_TYPY.map(t => `kontakt:${t}` as AccessScope),
]

export const ACCESS_SCOPE_LABELS: Record<string, string> = {
  nieruchomosci: 'Nieruchomości',
  leady: 'Leady',
  ...Object.fromEntries(KONTAKT_TYPY.map(t => [`kontakt:${t}`, `Kontakty: ${KONTAKT_TYP_LABELS[t]}`])),
}

/** Typ kontaktu z zakresu 'kontakt:<typ>' (null dla nieruchomości/leadów) */
export function kontaktTypOfScope(scope: string): KontaktTyp | null {
  return scope.startsWith('kontakt:') ? (scope.slice('kontakt:'.length) as KontaktTyp) : null
}

// ---------------------------------------------------------------
// Struktura grantów użytkownika (do enforcementu w trasach API)
// ---------------------------------------------------------------
export interface ScopeGrant {
  /** true = cała kategoria (dowolny właściciel) */
  all: boolean
  /** id właścicieli, których rekordy w tej kategorii user może widzieć */
  userIds: string[]
}

export interface UserGrants {
  nieruchomosci: ScopeGrant
  leady: ScopeGrant
  /** klucz = typ kontaktu */
  kontaktTypes: Partial<Record<KontaktTyp, ScopeGrant>>
}

interface AccessGrantRow {
  scope: string
  target_user_id: string | null
}

function emptyScopeGrant(): ScopeGrant {
  return { all: false, userIds: [] }
}

function addGrant(g: ScopeGrant, targetUserId: string | null) {
  if (targetUserId === null) g.all = true
  else if (!g.userIds.includes(targetUserId)) g.userIds.push(targetUserId)
}

/**
 * Wczytuje granty użytkownika i grupuje je per kategoria. Puste, gdy user
 * nie ma żadnych grantów. Czytane z sesją usera — RLS przepuszcza własne.
 */
export async function getUserGrants(supabase: SupabaseClient, granteeId: string): Promise<UserGrants> {
  const grants: UserGrants = {
    nieruchomosci: emptyScopeGrant(),
    leady: emptyScopeGrant(),
    kontaktTypes: {},
  }

  const { data } = await supabase
    .from('access_grants')
    .select('scope, target_user_id')
    .eq('grantee_id', granteeId)

  for (const row of (data ?? []) as AccessGrantRow[]) {
    if (row.scope === 'nieruchomosci') addGrant(grants.nieruchomosci, row.target_user_id)
    else if (row.scope === 'leady') addGrant(grants.leady, row.target_user_id)
    else {
      const typ = kontaktTypOfScope(row.scope)
      if (typ) {
        const g = grants.kontaktTypes[typ] ??= emptyScopeGrant()
        addGrant(g, row.target_user_id)
      }
    }
  }
  return grants
}

/** Czy user ma jakikolwiek grant do typu kontaktu (all lub per-osoba) */
export function hasKontaktTypeGrant(grants: UserGrants, typ: KontaktTyp): boolean {
  const g = grants.kontaktTypes[typ]
  return !!g && (g.all || g.userIds.length > 0)
}
