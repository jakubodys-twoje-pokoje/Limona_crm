'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { DELETION_ENTITY_LABELS, type DeletionEntityType } from '@/lib/deletion'

interface RequestDeletionModalProps {
  isOpen: boolean
  onClose: () => void
  entityType: DeletionEntityType
  entityId: string
  /** Czytelna etykieta rekordu (nazwa/adres) — pokazujemy, czego dotyczy prośba */
  entityLabel: string
  /** Wywoływane po udanym zgłoszeniu (np. zamknięcie karty) */
  onDone?: () => void
}

export function RequestDeletionModal({
  isOpen, onClose, entityType, entityId, entityLabel, onDone,
}: RequestDeletionModalProps) {
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (isOpen) setReason('') }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/deletion-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, reason: reason.trim() }),
    })
    setSaving(false)
    if (!res.ok) {
      showToast((await res.json()).error || 'Nie udało się wysłać prośby', 'error')
      return
    }
    showToast('Prośba o usunięcie wysłana do centrali', 'success')
    onDone?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Zgłoś do usunięcia" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-limona-yellow/40 bg-limona-yellow/5 p-3">
          <AlertTriangle size={15} className="text-limona-yellow flex-shrink-0 mt-0.5" />
          <p className="text-xs text-limona-text-muted">
            Nie usuwasz rekordu od razu — prośba trafia do centrali, która ją zatwierdzi albo odrzuci.
            Dostaniesz powiadomienie o decyzji.
          </p>
        </div>

        <div>
          <label className="limona-label block mb-1.5">Rekord</label>
          <div className="limona-input flex items-center text-limona-text truncate">
            {DELETION_ENTITY_LABELS[entityType]}: {entityLabel}
          </div>
        </div>

        <div>
          <label className="limona-label block mb-1.5">Powód usunięcia *</label>
          <textarea
            required
            autoFocus
            className="limona-input w-full min-h-[90px] resize-y text-sm"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Np. duplikat, błędne dane, rezygnacja klienta..."
            maxLength={1000}
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button type="submit" disabled={saving || !reason.trim()}
            className="limona-btn disabled:opacity-50">
            {saving ? 'Wysyłanie...' : 'Wyślij prośbę'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
