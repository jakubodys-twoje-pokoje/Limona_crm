'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface StatusChangeCommentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (comment: string) => void | Promise<void>
  /** np. „Zrobione", „Niezainteresowani: tak", „Odrzucony" */
  newStatusLabel: string
  /** np. „zadania", „nieruchomości", „leada", „kontaktu" — do treści prompta */
  entityLabel: string
}

/**
 * Wspólny prompt „dlaczego?" wymagany przy każdej zmianie statusu
 * (task/property/lead/kontakt). Komentarz trafia do istniejącego wątku
 * komentarzy danego bytu — nic nie ginie, wszystko zostaje w historii.
 */
export function StatusChangeCommentModal({
  isOpen, onClose, onConfirm, newStatusLabel, entityLabel,
}: StatusChangeCommentModalProps) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!comment.trim()) return
    setSaving(true)
    await onConfirm(comment.trim())
    setSaving(false)
    setComment('')
  }

  function handleClose() {
    setComment('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Uzasadnij zmianę statusu" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-limona-yellow/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-limona-yellow" />
          </div>
          <p className="text-sm text-limona-text">
            Zmieniasz status {entityLabel} na{' '}
            <span className="text-limona-white font-medium">{newStatusLabel}</span>.
            Krótko wyjaśnij dlaczego — to trafi do historii i liczy się do ewaluacji.
          </p>
        </div>

        <textarea
          className="limona-input w-full min-h-[80px] resize-y text-sm"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Np. właściciel nie odpowiada od 2 tygodni, brak zainteresowania ofertą..."
          autoFocus
        />

        <div className="flex gap-3 justify-end">
          <button onClick={handleClose} className="limona-btn-outline">Anuluj</button>
          <button
            onClick={handleConfirm}
            disabled={!comment.trim() || saving}
            className="limona-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Zapisywanie...' : 'Potwierdź zmianę'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
