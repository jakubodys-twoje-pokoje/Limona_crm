'use client'

import { useState } from 'react'
import { Building2, User, ArrowRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/database'

interface ConvertLeadModalProps {
  lead: Lead
  isOpen: boolean
  onClose: () => void
  /** Po udanej konwersji — rodzic odświeża listę i pokazuje linki */
  onConverted: (result: { propertyId: string | null; kontaktId: string | null }) => void
}

/**
 * Rozbicie leada na nieruchomość i/lub klienta (kontakt typ 'klient').
 * Dane z leada są wstępnie wypełnione — agent tylko weryfikuje i uzupełnia.
 */
export function ConvertLeadModal({ lead, isOpen, onClose, onConverted }: ConvertLeadModalProps) {
  const [createProperty, setCreateProperty] = useState(true)
  const [createKlient, setCreateKlient] = useState(true)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [propAdres, setPropAdres] = useState(lead.location || '')
  const [propKod, setPropKod] = useState('')
  const [propMiasto, setPropMiasto] = useState('')

  const [klientNazwa, setKlientNazwa] = useState(lead.name)
  const [klientTelefon, setKlientTelefon] = useState(lead.phone || '')
  const [klientEmail, setKlientEmail] = useState(lead.email || '')
  const [klientMiasto, setKlientMiasto] = useState('')

  const canSubmit =
    (createProperty || createKlient) &&
    comment.trim().length > 0 &&
    (!createProperty || propAdres.trim().length > 0) &&
    (!createKlient || klientNazwa.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.trim(),
          property: createProperty ? {
            adres: propAdres.trim(),
            kod_pocztowy: propKod.trim() || null,
            miasto: propMiasto.trim() || null,
          } : undefined,
          klient: createKlient ? {
            nazwa: klientNazwa.trim(),
            telefon: klientTelefon.trim() || null,
            email: klientEmail.trim() || null,
            miasto: klientMiasto.trim() || null,
          } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Błąd konwersji'); return }
      onConverted({ propertyId: data.propertyId, kontaktId: data.kontaktId })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Konwersja leada — ${lead.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-limona-text-muted">
          Lead po konwersji zostaje zamrożony jako ślad (skąd co się wzięło), a praca toczy się dalej
          na utworzonej nieruchomości i kliencie.
        </p>

        {/* Nieruchomość */}
        <div className={cn('rounded-lg border p-4 space-y-3 transition-colors', createProperty ? 'border-limona-blue/60' : 'border-limona-border opacity-60')}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={createProperty} onChange={e => setCreateProperty(e.target.checked)} className="w-4 h-4 accent-limona-lime" />
            <Building2 size={15} className="text-limona-blue" />
            <span className="text-sm font-bold text-limona-white">Utwórz nieruchomość</span>
          </label>
          {createProperty && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="limona-label block mb-1 text-[10px]">Adres *</label>
                <input required className="limona-input" value={propAdres} onChange={e => setPropAdres(e.target.value)} placeholder="ul. Przykładowa 1/2" />
              </div>
              <div>
                <label className="limona-label block mb-1 text-[10px]">Kod pocztowy</label>
                <input className="limona-input" value={propKod} onChange={e => setPropKod(e.target.value)} placeholder="00-000" />
              </div>
              <div className="sm:col-span-2">
                <label className="limona-label block mb-1 text-[10px]">Miasto</label>
                <input className="limona-input" value={propMiasto} onChange={e => setPropMiasto(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Klient */}
        <div className={cn('rounded-lg border p-4 space-y-3 transition-colors', createKlient ? 'border-limona-lime/60' : 'border-limona-border opacity-60')}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={createKlient} onChange={e => setCreateKlient(e.target.checked)} className="w-4 h-4 accent-limona-lime" />
            <User size={15} className="text-limona-lime" />
            <span className="text-sm font-bold text-limona-white">Utwórz klienta (kontakt)</span>
          </label>
          {createKlient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="limona-label block mb-1 text-[10px]">Imię i nazwisko / nazwa *</label>
                <input required className="limona-input" value={klientNazwa} onChange={e => setKlientNazwa(e.target.value)} />
              </div>
              <div>
                <label className="limona-label block mb-1 text-[10px]">Telefon</label>
                <input className="limona-input" value={klientTelefon} onChange={e => setKlientTelefon(e.target.value)} />
              </div>
              <div>
                <label className="limona-label block mb-1 text-[10px]">Email</label>
                <input type="email" className="limona-input" value={klientEmail} onChange={e => setKlientEmail(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="limona-label block mb-1 text-[10px]">Miasto</label>
                <input className="limona-input" value={klientMiasto} onChange={e => setKlientMiasto(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Komentarz — obowiązkowy jak przy każdej zmianie statusu */}
        <div>
          <label className="limona-label block mb-1 text-[10px]">Komentarz do konwersji *</label>
          <textarea
            required
            className="limona-input w-full min-h-[64px] resize-y text-sm"
            placeholder="Co ustalono? Dlaczego lead się zapiął?"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-limona-red">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button type="submit" disabled={!canSubmit || saving} className="limona-btn disabled:opacity-50 flex items-center gap-2">
            <ArrowRight size={14} />
            {saving ? 'Konwertuję...' : 'Konwertuj leada'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
