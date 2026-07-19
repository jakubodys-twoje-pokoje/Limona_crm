'use client'

import { useMemo, useState } from 'react'
import { Share2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { KONTAKT_TYP_LABELS } from '@/types/database'
import type { Kontakt, KontaktTyp, Profile } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  kontakty: Kontakt[]
  profiles: Profile[]
}

// Typy dostępne do zbiorczego udostępniania (bez inwestorów — dane wrażliwe)
const SHARE_TYPY: KontaktTyp[] = ['spoldzielnia', 'wspolnota', 'zarzadca', 'komornik', 'klient']
const DEFAULT_TYPY: KontaktTyp[] = ['spoldzielnia', 'wspolnota']

/**
 * Udostępnienie całego miasta jednym kliknięciem — np. wszystkie krakowskie
 * spółdzielnie i wspólnoty dla Jana, bez ręcznego przypisywania po jednej.
 */
export function ShareCityModal({ isOpen, onClose, kontakty, profiles }: Props) {
  const { showToast } = useToast()
  const [userId, setUserId] = useState('')
  const [miasto, setMiasto] = useState('')
  const [typy, setTypy] = useState<KontaktTyp[]>(DEFAULT_TYPY)
  const [sharing, setSharing] = useState(false)

  // Miasta z liczbą kontaktów pasujących do wybranych typów
  const miasta = useMemo(() => {
    const counts = new Map<string, number>()
    for (const k of kontakty) {
      const m = k.miasto?.trim()
      if (!m || !typy.includes(k.typ as KontaktTyp)) continue
      counts.set(m, (counts.get(m) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pl'))
  }, [kontakty, typy])

  const matchCount = useMemo(
    () => miasta.find(([m]) => m === miasto)?.[1] ?? 0,
    [miasta, miasto]
  )

  function toggleTyp(t: KontaktTyp) {
    setTypy(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !miasto || !typy.length) return
    setSharing(true)
    const res = await fetch('/api/kontakty/shares/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, miasto, typy }),
    })
    setSharing(false)
    if (!res.ok) {
      showToast((await res.json()).error || 'Błąd udostępniania', 'error')
      return
    }
    const { shared, matched } = await res.json()
    const who = profiles.find(p => p.id === userId)?.full_name || 'użytkownikowi'
    showToast(
      shared > 0
        ? `Udostępniono ${shared} z ${matched} kontaktów (${miasto}) — ${who}`
        : `Wszystkie kontakty z ${miasto} były już udostępnione — ${who}`,
      'success'
    )
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Udostępnij całe miasto" size="md">
      <form onSubmit={handleShare} className="space-y-5">
        <p className="text-sm text-limona-text-muted">
          Wybrana osoba zobaczy wszystkie kontakty z danego miasta — bez ręcznego
          udostępniania po jednym. Kontakty dodane później udostępnisz, klikając
          to samo miasto ponownie.
        </p>

        <div>
          <label className="limona-label block mb-2">Komu udostępnić</label>
          <select className="limona-input w-full" value={userId} onChange={e => setUserId(e.target.value)} required>
            <option value="">— wybierz osobę —</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        <div>
          <label className="limona-label block mb-2">Typy kontaktów</label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SHARE_TYPY.map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
                <input
                  type="checkbox"
                  checked={typy.includes(t)}
                  onChange={() => toggleTyp(t)}
                  className="accent-[#BEFF00] w-4 h-4"
                />
                {KONTAKT_TYP_LABELS[t]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="limona-label block mb-2">Miasto</label>
          <select className="limona-input w-full" value={miasto} onChange={e => setMiasto(e.target.value)} required>
            <option value="">— wybierz miasto —</option>
            {miasta.map(([m, count]) => (
              <option key={m} value={m}>{m} ({count})</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button
            type="submit"
            disabled={sharing || !userId || !miasto || !typy.length}
            className="limona-btn flex items-center gap-2 disabled:opacity-50"
          >
            <Share2 size={14} />
            {sharing ? 'Udostępnianie…' : matchCount > 0 ? `Udostępnij ${matchCount} kontaktów` : 'Udostępnij'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
