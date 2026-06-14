'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Lead } from '@/types/database'

export function useLeads(status?: string) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    const res = await fetch(`/api/leads?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLeads(data as Lead[])
    }
    setLoading(false)
  }, [status])

  useEffect(() => {
    fetchLeads()
    const id = setInterval(fetchLeads, 30000)
    return () => clearInterval(id)
  }, [fetchLeads])

  return { leads, loading, refetch: fetchLeads }
}
