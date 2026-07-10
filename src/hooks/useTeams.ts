'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Team, Profile } from '@/types/database'

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [teamsRes, profilesRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/profiles'),
    ])
    if (teamsRes.ok) setTeams(await teamsRes.json())
    if (profilesRes.ok) setProfiles(await profilesRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const createTeam = async (name: string, description: string | null, memberIds: string[], leadIds: string[]) => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, memberIds, leadIds }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const updateTeam = async (id: string, updates: { name?: string; description?: string | null }) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const deleteTeam = async (id: string) => {
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const addMembers = async (teamId: string, userIds: string[], isLead = false) => {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, isLead }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const setMemberLead = async (teamId: string, userId: string, isLead: boolean) => {
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLead }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  const removeMember = async (teamId: string, userId: string) => {
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    await fetchData()
    return { error: null }
  }

  return {
    teams, profiles, loading, refetch: fetchData,
    createTeam, updateTeam, deleteTeam, addMembers, setMemberLead, removeMember,
  }
}
