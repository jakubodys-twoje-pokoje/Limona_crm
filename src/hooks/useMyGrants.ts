'use client'

import { useEffect, useState } from 'react'
import type { UserGrants } from '@/lib/access'

const EMPTY: UserGrants = { nieruchomosci: { all: false, userIds: [] }, leady: { all: false, userIds: [] }, kontaktTypes: {} }

/**
 * Granty bieżącego użytkownika — używane do odblokowania sekcji w UI
 * (np. zakładka Inwestorzy dla usera z grantem na inwestorów).
 */
export function useMyGrants(userId: string | undefined) {
  const [grants, setGrants] = useState<UserGrants>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetch('/api/access-grants/me')
      .then(r => r.ok ? r.json() : EMPTY)
      .then((g: UserGrants) => { setGrants(g || EMPTY); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  return { grants, loading }
}

/** Czy user ma jakikolwiek dostęp do inwestorów (grant all lub per-osoba) */
export function grantsIncludeInvestors(grants: UserGrants): boolean {
  const g = grants.kontaktTypes.inwestor
  return !!g && (g.all || g.userIds.length > 0)
}
