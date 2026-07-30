'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Property } from '@/types/database'

export function useProperties(visibleUserIds?: string[] | null, enabled: boolean = true, archived: boolean = false) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializedRef = useRef(false)

  const fetchProperties = useCallback(async () => {
    // enabled=false, dopóki nie znamy uprawnień widoczności — inaczej pierwszy
    // fetch leci bez filtra i agent przez moment widzi cudze karty
    if (!enabled) return
    if (!initializedRef.current) setLoading(true)
    const params = new URLSearchParams()
    if (visibleUserIds?.length) params.set('visibleIds', visibleUserIds.join(','))
    if (archived) params.set('archived', '1')

    const res = await fetch(`/api/properties?${params}`)
    if (!res.ok) { setError('Fetch error'); setLoading(false); return }
    const data = await res.json()
    setProperties(data)
    setLoading(false)
    initializedRef.current = true
  }, [visibleUserIds, enabled, archived])

  const debouncedFetch = useDebouncedCallback(fetchProperties, 500)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initializedRef.current = false
    fetchProperties()
    intervalRef.current = setInterval(debouncedFetch, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchProperties, debouncedFetch])

  const createProperty = async (data: Partial<Property>, _userId: string): Promise<{ data: Property | null; error: string | null }> => {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return { data: null, error: (await res.json()).error || 'Error' }
    const newProp = await res.json()
    fetchProperties()
    return { data: newProp, error: null }
  }

  const updateProperty = async (id: string, updates: Partial<Property>, _userId: string) => {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) return { data: null, error: (await res.json()).error || 'Error' }
    const updated = await res.json()
    fetchProperties()
    return { data: updated, error: null }
  }

  const deleteProperty = async (id: string) => {
    const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: (await res.json()).error || 'Error' }
    fetchProperties()
    return { error: null }
  }

  return { properties, loading, error, fetchProperties, createProperty, updateProperty, deleteProperty }
}
