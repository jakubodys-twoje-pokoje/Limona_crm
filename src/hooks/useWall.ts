'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface WallMessage {
  id: string
  user_id: string | null
  content: string
  pinned: boolean
  created_at: string
  user?: { id: string; full_name: string; avatar_url: string | null; role: string }
}

export function useWall() {
  const [messages, setMessages] = useState<WallMessage[]>([])
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

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel('wall-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchMessages])

  const postMessage = async (content: string, userId: string) => {
    const { error } = await supabase.from('wall_messages').insert({ content, user_id: userId })
    return { error: error?.message ?? null }
  }

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from('wall_messages').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  const togglePin = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from('wall_messages').update({ pinned: !pinned }).eq('id', id)
    return { error: error?.message ?? null }
  }

  return { messages, loading, postMessage, deleteMessage, togglePin }
}
