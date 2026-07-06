'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Profile } from '@/types/database'

export interface TeamVisibilityRule {
  id: string
  manager_id: string
  member_id: string
  created_at: string
  manager?: Profile
  member?: Profile
}

export function useTeamVisibility() {
  const [rules, setRules] = useState<TeamVisibilityRule[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [rulesRes, profilesRes] = await Promise.all([
      fetch('/api/team'),
      fetch('/api/profiles'),
    ])
    if (rulesRes.ok) setRules(await rulesRes.json())
    if (profilesRes.ok) setProfiles(await profilesRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const addRule = async (managerId: string, memberId: string, _adminId: string) => {
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId, memberId }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const removeRule = async (id: string) => {
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: 'Error' }
    await fetchData()
    return { error: null }
  }

  return { rules, profiles, loading, addRule, removeRule, refetch: fetchData }
}

export function useVisibleUserIds(userId: string | undefined, role: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    fetch('/api/team/visible-ids')
      .then(res => res.json())
      .then(data => {
        setVisibleIds(data.visibleIds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId, role])

  return { visibleIds, loading }
}
