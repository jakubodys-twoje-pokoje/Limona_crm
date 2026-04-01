'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

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

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('wall_messages')
      .select('*, user:user_id(id, full_name, avatar_url, role)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    setMessages((data as WallMessage[]) || [])
    setLoading(false)
  }, [])

  const fetchReads = useCallback(async () => {
    if (!currentUserId) return
    const { data } = await supabase
      .from('wall_reads')
      .select('message_id')
      .eq('user_id', currentUserId)
    setReadIds(new Set((data || []).map((r: { message_id: string }) => r.message_id)))
  }, [currentUserId])

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    fetchMessages()
    fetchReads()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`wall-realtime-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_messages' }, fetchMessages)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchMessages, fetchReads])

  const unreadCount = messages.filter(m => !readIds.has(m.id) && m.user_id !== currentUserId).length

  const postMessage = async (content: string, userId: string) => {
    const { data, error } = await supabase
      .from('wall_messages')
      .insert({ content, user_id: userId })
      .select()
      .single()
    if (error) return { error: error.message, data: null }
    // Mark own message as read
    if (data) {
      await supabase.from('wall_reads').insert({ user_id: userId, message_id: data.id })
      setReadIds(prev => { const next = new Set(Array.from(prev)); next.add(data.id); return next })
    }
    return { error: null, data }
  }

  const markAsRead = async (messageId: string, userId: string) => {
    if (readIds.has(messageId)) return
    await supabase.from('wall_reads').insert({ user_id: userId, message_id: messageId }).select()
    setReadIds(prev => { const next = new Set(Array.from(prev)); next.add(messageId); return next })
  }

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from('wall_messages').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  const togglePin = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from('wall_messages').update({ pinned: !pinned }).eq('id', id)
    return { error: error?.message ?? null }
  }

  const isRead = (messageId: string) => readIds.has(messageId)

  return { messages, loading, unreadCount, postMessage, deleteMessage, togglePin, markAsRead, isRead }
}
