'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ActivityLog } from '@/types/database'

export function useActivityLog(propertyId: string) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select(`*, user:user_id(id, full_name, avatar_url)`)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(50)

    setLogs((data as ActivityLog[]) || [])
    setLoading(false)
  }, [propertyId])

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    fetchLogs()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`activity-${propertyId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `property_id=eq.${propertyId}`,
      }, fetchLogs)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchLogs, propertyId])

  return { logs, loading }
}
