'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Send, Trash2, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatMoney } from '@/lib/utils'
import type { InvestorPropertyStatus, PropertyInvestor, PropertyNegotiationNote } from '@/types/database'
import { INVESTOR_PROPERTY_STATUS_LABELS, INVESTOR_PROPERTY_STATUS_OPTIONS } from '@/lib/stages'

interface InvestorOfferCardProps {
  propertyId: string
  investor: PropertyInvestor
  onStatusChange: (id: string, status: InvestorPropertyStatus) => void
  onRemove: (id: string) => void
  onOfferChange: (id: string, amount: number | null) => void
}

export function InvestorOfferCard({ propertyId, investor, onStatusChange, onRemove, onOfferChange }: InvestorOfferCardProps) {
  const [offerInput, setOfferInput] = useState(investor.offer_amount != null ? String(investor.offer_amount) : '')
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState<PropertyNegotiationNote[]>([])
  const [loading, setLoading] = useState(false)
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    setOfferInput(investor.offer_amount != null ? String(investor.offer_amount) : '')
  }, [investor.offer_amount])

  async function fetchNotes() {
    setLoading(true)
    const res = await fetch(`/api/properties/${propertyId}/negotiation?investorId=${investor.id}`)
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }

  function toggleExpanded() {
    const next = !expanded
    setExpanded(next)
    if (next && notes.length === 0) fetchNotes()
  }

  function saveOffer() {
    const trimmed = offerInput.trim()
    const amount = trimmed ? Number(trimmed.replace(',', '.')) : null
    if (amount !== null && Number.isNaN(amount)) return
    onOfferChange(investor.id, amount)
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return
    const res = await fetch(`/api/properties/${propertyId}/negotiation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote.trim(), investorId: investor.id }),
    })
    if (res.ok) { setNewNote(''); fetchNotes() }
  }

  async function handleDeleteNote(noteId: string) {
    await fetch(`/api/properties/${propertyId}/negotiation/${noteId}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <div className="limona-card p-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <p className="text-sm font-medium text-limona-text">{investor.kontakt?.nazwa || '—'}</p>
          {investor.kontakt?.telefon && <p className="text-xs text-limona-text-dim">{investor.kontakt.telefon}</p>}
        </div>

        <div className="flex items-center gap-1">
          <label className="text-[10px] text-limona-text-dim uppercase tracking-wider">Oferta</label>
          <input
            type="number"
            inputMode="decimal"
            className="limona-input w-28 text-xs py-1.5"
            placeholder="zł"
            value={offerInput}
            onChange={e => setOfferInput(e.target.value)}
            onBlur={saveOffer}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>

        <select
          className="limona-select w-auto text-xs py-1.5"
          value={investor.status}
          onChange={e => onStatusChange(investor.id, e.target.value as InvestorPropertyStatus)}
        >
          {INVESTOR_PROPERTY_STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{INVESTOR_PROPERTY_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <button
          onClick={toggleExpanded}
          className="flex items-center gap-1 text-[10px] text-limona-text-dim hover:text-limona-lime transition-colors flex-shrink-0"
        >
          <MessageSquare size={12} />
          {notes.length > 0 ? notes.length : ''}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <button onClick={() => onRemove(investor.id)} className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {investor.offer_amount != null && (
        <p className="text-xs text-limona-lime font-mono">Zaoferował: {formatMoney(investor.offer_amount)}</p>
      )}

      {expanded && (
        <div className="pt-2 border-t border-limona-border/50 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold">
            Komentarze do tej oferty — przebieg negocjacji z {investor.kontakt?.nazwa || 'inwestorem'}
          </p>
          {loading ? (
            <div className="space-y-1.5">{[1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-limona-text-dim">Brak komentarzy do tej oferty</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {notes.map(note => (
                <div key={note.id} className="flex items-start gap-2 group bg-limona-surface-2/50 rounded p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-limona-text whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-limona-text-dim mt-0.5">
                      {note.user?.full_name || 'Użytkownik'} · {new Date(note.created_at).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteNote(note.id)}
                    className={cn('p-0.5 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0')}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              className="limona-input flex-1 text-xs py-2"
              placeholder="Nowy komentarz do tej oferty..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <button type="submit" disabled={!newNote.trim()} className="p-2 text-limona-text-muted hover:text-limona-lime disabled:opacity-30 transition-colors">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
