'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface TaskComment {
  id: string
  task_id: string
  user_id: string | null
  content: string
  created_at: string
  updated_at: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export function useTaskComments(taskId: string) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*, user:user_id(id, full_name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    setComments((data as TaskComment[]) || [])
    setLoading(false)
  }, [taskId])

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    fetchComments()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`comments-${taskId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
      }, fetchComments)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchComments, taskId])

  const addComment = async (content: string, userId: string) => {
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: taskId, user_id: userId, content })
      .select('*, user:user_id(id, full_name, avatar_url)')
      .single()
    if (error) return { error: error.message }
    return { error: null, data }
  }

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('task_comments').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  return { comments, loading, addComment, deleteComment }
}
