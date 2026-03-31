'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

  useEffect(() => {
    fetchLogs()

    const channel = supabase
      .channel(`activity-${propertyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `property_id=eq.${propertyId}`,
      }, fetchLogs)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchLogs, propertyId])

  return { logs, loading }
}
