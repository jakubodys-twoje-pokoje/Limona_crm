'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Kontakt } from '@/types/database'

export interface KontaktyFilters {
  typ?: string
  wojewodztwo?: string
  miasto?: string
  assigned_to?: string
  search?: string
  wizyta_osobista?: boolean
  wyslany_mail_oferta?: boolean
  chec_wspolpracy?: boolean
  niezainteresowani?: boolean
  zgoda_ulotki?: boolean
  zgoda_plakat?: boolean
  operator_budowy_zainteresowani?: boolean
  visibleIds?: string[] | null
}

export function useKontakty(filters?: KontaktyFilters) {
  const [kontakty, setKontakty] = useState<Kontakt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (!filters) return p
    if (filters.typ)         p.set('typ', filters.typ)
    if (filters.wojewodztwo) p.set('wojewodztwo', filters.wojewodztwo)
    if (filters.miasto)      p.set('miasto', filters.miasto)
    if (filters.assigned_to) p.set('assigned_to', filters.assigned_to)
    if (filters.search)      p.set('search', filters.search)
    if (filters.visibleIds?.length) p.set('visibleIds', filters.visibleIds.join(','))
    for (const flag of [
      'wizyta_osobista',
      'wyslany_mail_oferta',
      'chec_wspolpracy',
      'niezainteresowani',
      'zgoda_ulotki',
      'zgoda_plakat',
      'operator_budowy_zainteresowani',
    ] as const) {
      if (filters[flag]) p.set(flag, '1')
    }
    return p
  }, [filters])

  const initializedRef = useRef(false)

  const fetchKontakty = useCallback(async () => {
    if (!initializedRef.current) setLoading(true)
    const res = await fetch(`/api/kontakty?${buildParams()}`)
    if (!res.ok) { setError('Błąd pobierania danych'); setLoading(false); return }
    setKontakty(await res.json())
    setLoading(false)
    initializedRef.current = true
  }, [buildParams])

  const debouncedFetch = useDebouncedCallback(fetchKontakty, 500)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initializedRef.current = false
    fetchKontakty()
    intervalRef.current = setInterval(debouncedFetch, 20000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchKontakty, debouncedFetch])

  const createKontakt = async (data: Partial<Kontakt>): Promise<{ data: Kontakt | null; error: string | null }> => {
    try {
      const res = await fetch('/api/kontakty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { data: null, error: body.error || `Błąd serwera (${res.status})` }
      }
      const created = await res.json()
      fetchKontakty()
      return { data: created, error: null }
    } catch {
      return { data: null, error: 'Błąd połączenia z serwerem' }
    }
  }

  const updateKontakt = async (id: string, updates: Partial<Kontakt>): Promise<{ data: Kontakt | null; error: string | null }> => {
    try {
      const res = await fetch(`/api/kontakty/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { data: null, error: body.error || `Błąd serwera (${res.status})` }
      }
      const updated = await res.json()
      fetchKontakty()
      return { data: updated, error: null }
    } catch {
      return { data: null, error: 'Błąd połączenia z serwerem' }
    }
  }

  const deleteKontakt = async (id: string): Promise<{ error: string | null }> => {
    const res = await fetch(`/api/kontakty/${id}`, { method: 'DELETE' })
    if (!res.ok) return { error: (await res.json()).error || 'Błąd' }
    fetchKontakty()
    return { error: null }
  }

  return { kontakty, loading, error, fetchKontakty, createKontakt, updateKontakt, deleteKontakt }
}
