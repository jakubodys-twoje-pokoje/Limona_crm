'use client'

import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Profile } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY, KONTAKT_ROZMIAR_LABELS, KONTAKT_ROZMIARY } from '@/types/database'

const WOJEWODZTWA = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie',
  'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie',
  'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie',
  'wielkopolskie', 'zachodniopomorskie',
]

// Wartości specjalne selectów: '' = bez zmian, CLEAR = wyczyść pole
const CLEAR = '__clear__'

interface Props {
  isOpen: boolean
  onClose: () => void
  selectedIds: string[]
  profiles: Profile[]
  onDone: (updated: number) => void
}

/**
 * Zbiorcza edycja zaznaczonych kontaktów — tylko admin (API pilnuje).
 * Pole zostawione jako „bez zmian" nie jest wysyłane w ogóle.
 */
export function KontaktyBatchEditModal({ isOpen, onClose, selectedIds, profiles, onDone }: Props) {
  const [miasto, setMiasto] = useState('')
  const [clearMiasto, setClearMiasto] = useState(false)
  const [wojewodztwo, setWojewodztwo] = useState('')
  const [typ, setTyp] = useState('')
  const [rozmiar, setRozmiar] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updates: Record<string, string> = {}
  if (clearMiasto) updates.miasto = ''
  else if (miasto.trim()) updates.miasto = miasto.trim()
  if (wojewodztwo) updates.wojewodztwo = wojewodztwo === CLEAR ? '' : wojewodztwo
  if (typ) updates.typ = typ
  if (rozmiar) updates.rozmiar = rozmiar === CLEAR ? '' : rozmiar
  if (assignedTo) updates.assigned_to = assignedTo === CLEAR ? '' : assignedTo

  const hasChanges = Object.keys(updates).length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/kontakty/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Błąd zapisu'); return }
      onDone(data.updated)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edycja zbiorcza — ${selectedIds.length} kontaktów`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-limona-text-muted">
          Zmienią się tylko wypełnione pola — puste zostają bez zmian. Operacja obejmie
          <strong className="text-limona-white"> {selectedIds.length}</strong> zaznaczonych kontaktów.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Miasto</label>
            <input
              className="limona-input"
              placeholder="— bez zmian —"
              value={miasto}
              disabled={clearMiasto}
              onChange={e => setMiasto(e.target.value)}
            />
            <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-limona-text-dim cursor-pointer select-none">
              <input type="checkbox" checked={clearMiasto} onChange={e => setClearMiasto(e.target.checked)} className="w-3 h-3 accent-limona-lime" />
              wyczyść miasto we wszystkich zaznaczonych
            </label>
          </div>
          <div>
            <label className="limona-label block mb-2">Województwo</label>
            <select className="limona-select" value={wojewodztwo} onChange={e => setWojewodztwo(e.target.value)}>
              <option value="">— bez zmian —</option>
              {WOJEWODZTWA.map(w => <option key={w} value={w}>{w}</option>)}
              <option value={CLEAR}>— wyczyść pole —</option>
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Typ</label>
            <select className="limona-select" value={typ} onChange={e => setTyp(e.target.value)}>
              <option value="">— bez zmian —</option>
              {KONTAKT_TYPY.map(t => <option key={t} value={t}>{KONTAKT_TYP_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Rozmiar</label>
            <select className="limona-select" value={rozmiar} onChange={e => setRozmiar(e.target.value)}>
              <option value="">— bez zmian —</option>
              {KONTAKT_ROZMIARY.map(r => <option key={r} value={r}>{KONTAKT_ROZMIAR_LABELS[r]}</option>)}
              <option value={CLEAR}>— wyczyść pole —</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="limona-label block mb-2">Opiekun</label>
            <select className="limona-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">— bez zmian —</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              <option value={CLEAR}>— usuń opiekuna —</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-limona-red">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button type="submit" disabled={!hasChanges || saving} className="limona-btn disabled:opacity-50 flex items-center gap-2">
            <Layers size={14} />
            {saving ? 'Zapisywanie...' : `Zapisz w ${selectedIds.length} kontaktach`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
