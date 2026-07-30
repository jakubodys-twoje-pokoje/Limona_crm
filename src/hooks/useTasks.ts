'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Task } from '@/types/database'

export function useTasks(propertyId?: string, visibleUserIds?: string[] | null, boardId?: string | null, kontaktId?: string, enabled: boolean = true, leadId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const initializedRef = useRef(false)

  const fetchTasks = useCallback(async () => {
    // enabled=false, dopóki nie znamy uprawnień widoczności — inaczej pierwszy
    // fetch leci bez filtra i agent przez moment widzi cudze zadania
    if (!enabled) return
    if (!initializedRef.current) setLoading(true)
    const params = new URLSearchParams()
    if (propertyId) params.set('propertyId', propertyId)
    if (kontaktId) params.set('kontaktId', kontaktId)
    if (leadId) params.set('leadId', leadId)
    if (visibleUserIds?.length) params.set('visibleIds', visibleUserIds.join(','))
    if (boardId !== undefined) params.set('boardId', boardId ?? 'none')

    const res = await fetch(`/api/tasks?${params}`)
    if (res.ok) setTasks(await res.json())
    setLoading(false)
    initializedRef.current = true
  }, [propertyId, visibleUserIds, boardId, kontaktId, leadId, enabled])

  const debouncedFetch = useDebouncedCallback(fetchTasks, 500)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initializedRef.current = false
    fetchTasks()
    intervalRef.current = setInterval(debouncedFetch, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchTasks, debouncedFetch])

  const createTask = async (data: Partial<Task>, _userId: string) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return { data: null, error: (await res.json()).error || 'Error' }
    const newTask = await res.json()
    fetchTasks()
    return { data: newTask, error: null }
  }

  const updateTask = async (id: string, updates: Partial<Task>, _userId: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) return { data: null, error: (await res.json()).error || 'Error' }
    const updated = await res.json()
    fetchTasks()
    return { data: updated, error: null }
  }

  const deleteTask = async (id: string, scope?: 'one' | 'following' | 'series') => {
    const qs = scope && scope !== 'one' ? `?scope=${scope}` : ''
    const res = await fetch(`/api/tasks/${id}${qs}`, { method: 'DELETE' })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    fetchTasks()
    return { error: null }
  }

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask }
}
