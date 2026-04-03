'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'

export interface WallMessage {
  id: string
  user_id: string | null
  content: string
  pinned: boolean
  created_at: string
  user?: { id: string; full_name: string; avatar_url: string | null; role: string }
}

export function useWall(currentUserId?: string) {
  const [messages, setMessages] = useState<WallMessage[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/wall')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setMessages(data.messages || [])
    setReadIds(new Set(data.readIds || []))
    setLoading(false)
  }, [])

  const debouncedFetch = useDebouncedCallback(fetchAll, 500)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(debouncedFetch, 5000) // poll every 5s for wall
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchAll, debouncedFetch])

  const unreadCount = messages.filter(m => !readIds.has(m.id) && m.user_id !== currentUserId).length

  const postMessage = async (content: string, _userId: string) => {
    const res = await fetch('/api/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Error', data: null }
    const data = await res.json()
    setReadIds(prev => { const next = new Set(Array.from(prev)); next.add(data.id); return next })
    fetchAll()
    return { error: null, data }
  }

  const markAsRead = async (messageId: string, _userId: string) => {
    if (readIds.has(messageId)) return
    await fetch('/api/wall/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
    setReadIds(prev => { const next = new Set(Array.from(prev)); next.add(messageId); return next })
  }

  const deleteMessage = async (id: string) => {
    const res = await fetch(`/api/wall/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: 'Error' }
    fetchAll()
    return { error: null }
  }

  const togglePin = async (id: string, pinned: boolean) => {
    const res = await fetch(`/api/wall/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !pinned }),
    })
    if (!res.ok) return { error: 'Error' }
    fetchAll()
    return { error: null }
  }

  const isRead = (messageId: string) => readIds.has(messageId)

  return { messages, loading, unreadCount, postMessage, deleteMessage, togglePin, markAsRead, isRead }
}
