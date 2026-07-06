'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { KontaktKomentarz } from '@/types/database'

export function useKontaktKomentarze(kontaktId: string) {
  const [komentarze, setKomentarze] = useState<KontaktKomentarz[]>([])
  const [loading, setLoading] = useState(true)

  const fetchKomentarze = useCallback(async () => {
    const res = await fetch(`/api/kontakty/${kontaktId}/komentarze`)
    if (res.ok) setKomentarze(await res.json())
    setLoading(false)
  }, [kontaktId])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchKomentarze()
    intervalRef.current = setInterval(fetchKomentarze, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchKomentarze])

  const addKomentarz = async (content: string): Promise<{ error: string | null }> => {
    const res = await fetch(`/api/kontakty/${kontaktId}/komentarze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) return { error: (await res.json()).error || 'Błąd' }
    const added: KontaktKomentarz = await res.json()
    setKomentarze(prev => [...prev, added])
    return { error: null }
  }

  return { komentarze, loading, addKomentarz, refetch: fetchKomentarze }
}
