'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ActivityLog } from '@/types/database'

export function useActivityLog(propertyId: string) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/activity?propertyId=${propertyId}`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [propertyId])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchLogs()
    intervalRef.current = setInterval(fetchLogs, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchLogs])

  return { logs, loading }
}
