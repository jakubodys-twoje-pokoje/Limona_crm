'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Notification {
  id: string
  user_id: string
  from_user_id: string | null
  type: 'mention_wall' | 'mention_task' | 'task_assigned' | 'comment_added'
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

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*, from_user:from_user_id(id, full_name, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const notifs = (data as Notification[]) || []
    setNotifications(notifs)
    setUnreadCount(notifs.filter(n => !n.read).length)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifications()

    if (!userId) return

    const channelName = `notifications-${userId}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        fetchNotifications()
        // Dispatch custom event for the modal popup
        window.dispatchEvent(new CustomEvent('limona-notification', {
          detail: payload.new
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications, userId])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    if (!userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return { notifications, unreadCount, loading, markAsRead, markAllRead, deleteNotification, refetch: fetchNotifications }
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
  await supabase.from('notifications').insert({
    user_id: params.userId,
    from_user_id: params.fromUserId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    link: params.link || null,
    reference_id: params.referenceId || null,
  })
}
