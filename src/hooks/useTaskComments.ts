'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

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
    const res = await fetch(`/api/comments?taskId=${taskId}`)
    if (res.ok) setComments(await res.json())
    setLoading(false)
  }, [taskId])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchComments()
    intervalRef.current = setInterval(fetchComments, 15000) // poll every 15s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchComments])

  const addComment = async (content: string, _userId: string) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, content }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    const data = await res.json()
    fetchComments()
    return { error: null, data }
  }

  const deleteComment = async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: 'Error' }
    fetchComments()
    return { error: null }
  }

  return { comments, loading, addComment, deleteComment }
}
