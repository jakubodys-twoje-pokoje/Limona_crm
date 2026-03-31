'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

  const fetch = useCallback(async () => {
    const [rulesRes, profilesRes] = await Promise.all([
      supabase
        .from('team_visibility')
        .select('*, manager:manager_id(id, full_name, avatar_url, role), member:member_id(id, full_name, avatar_url, role)')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .order('full_name'),
    ])

    setRules((rulesRes.data as TeamVisibilityRule[]) || [])
    setProfiles((profilesRes.data as Profile[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const addRule = async (managerId: string, memberId: string, adminId: string) => {
    const { error } = await supabase.from('team_visibility').insert({
      manager_id: managerId,
      member_id: memberId,
      created_by: adminId,
    })
    if (error) return { error: error.message }
    await fetch()
    return { error: null }
  }

  const removeRule = async (id: string) => {
    const { error } = await supabase.from('team_visibility').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetch()
    return { error: null }
  }

  return { rules, profiles, loading, addRule, removeRule }
}

/**
 * Returns the list of user IDs whose tasks the current user can see.
 * - Admin sees everything (returns null = no filter)
 * - Manager sees own + members assigned to them
 * - Regular user sees only own
 */
export function useVisibleUserIds(userId: string | undefined, role: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    // Admin sees all
    if (role === 'admin') {
      setVisibleIds(null) // null = no filter
      setLoading(false)
      return
    }

    // Fetch who this user manages
    supabase
      .from('team_visibility')
      .select('member_id')
      .eq('manager_id', userId)
      .then(({ data }) => {
        const memberIds = (data || []).map(r => r.member_id)
        setVisibleIds([userId, ...memberIds]) // own + managed
        setLoading(false)
      })
  }, [userId, role])

  return { visibleIds, loading }
}
