'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

export interface Notification {
  id: string
  user_id: string
  from_user_id: string | null
  type: 'mention_wall' | 'mention_task' | 'task_assigned' | 'comment_added' | 'dm_message' | 'group_message' | 'new_lead' | 'card_change' | 'card_comment' | 'deletion_request' | 'deletion_decision'
  title: string
  body: string | null
  link: string | null
  reference_id: string | null
  read: boolean
  created_at: string
  from_user?: { id: string; full_name: string; avatar_url: string | null }
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const prevCountRef = useRef(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const res = await fetch('/api/notifications')
    if (!res.ok) { setLoading(false); return }
    const data: Notification[] = await res.json()
    setNotifications(data)
    const newUnread = data.filter(n => !n.read).length

    // Dispatch popup if new notifications arrived
    if (newUnread > prevCountRef.current && data.length > 0) {
      const newest = data[0]
      if (!newest.read) {
        window.dispatchEvent(new CustomEvent('limona-notification', { detail: newest }))
      }
    }
    prevCountRef.current = newUnread
    setUnreadCount(newUnread)
    setLoading(false)
  }, [userId])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    prevCountRef.current = Math.max(0, prevCountRef.current - 1)
  }

  const markAllRead = async () => {
    if (!userId) return
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    prevCountRef.current = 0
  }

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const deleteAllRead = async () => {
    await fetch('/api/notifications?read=1', { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => !n.read))
  }

  const deleteAll = async () => {
    await fetch('/api/notifications', { method: 'DELETE' })
    setNotifications([])
    setUnreadCount(0)
    prevCountRef.current = 0
  }

  return { notifications, unreadCount, loading, markAsRead, markAllRead, deleteNotification, deleteAllRead, deleteAll, refetch: fetchNotifications }
}

// Helper: create a notification
export async function createNotification(params: {
  userId: string
  fromUserId: string
  type: Notification['type']
  title: string
  body?: string
  link?: string
  referenceId?: string
}) {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}
