'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Task } from '@/types/database'

/**
 * @param propertyId - filter tasks for a specific property
 * @param visibleUserIds - array of user IDs whose tasks to show (null = show all, e.g. for admin)
 */
export function useTasks(propertyId?: string, visibleUserIds?: string[] | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select(`
        *,
        property:property_id(id, location),
        assignee:assigned_to(id, full_name, avatar_url),
        creator:created_by(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    // Apply visibility filter: only show tasks assigned to or created by visible users
    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.or(
        `assigned_to.in.(${visibleUserIds.join(',')}),created_by.in.(${visibleUserIds.join(',')})`
      )
    }

    const { data } = await query
    setTasks((data as Task[]) || [])
    setLoading(false)
  }, [propertyId, visibleUserIds])

  const debouncedFetchTasks = useDebouncedCallback(fetchTasks, 500)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    fetchTasks()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`tasks-${propertyId || 'all'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedFetchTasks)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchTasks, propertyId])

  const createTask = async (data: Partial<Task>, userId: string) => {
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({ ...data, created_by: userId })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    if (data.property_id) {
      await supabase.from('activity_log').insert({
        property_id: data.property_id,
        task_id: newTask.id,
        user_id: userId,
        action: 'task_created',
        details: { title: newTask.title },
      })
    }
    return { data: newTask, error: null }
  }

  const updateTask = async (id: string, updates: Partial<Task>, userId: string) => {
    const isCompleting = updates.status === 'done'
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        ...(isCompleting ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  }

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask }
}
