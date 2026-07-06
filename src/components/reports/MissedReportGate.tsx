'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

/**
 * Sprawdza przy wejściu do aplikacji, czy wczorajszy raport został
 * przesłany. Jeśli nie — blokujący popup z potwierdzeniem, które
 * zapisuje się do missed_report_acks (zliczane do ewaluacji).
 */
export function MissedReportGate() {
  const [missedDate, setMissedDate] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/reports/missed')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.missed) setMissedDate(d.date) })
  }, [])

  async function handleConfirm() {
    if (!missedDate || !acknowledged) return
    setSaving(true)
    const res = await fetch('/api/reports/missed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: missedDate }),
    })
    setSaving(false)
    if (res.ok) setMissedDate(null)
  }

  if (!missedDate) return null

  const dateLabel = new Date(`${missedDate}T12:00:00`).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    // Zamknięcie tylko przez potwierdzenie — onClose celowo nic nie robi
    <Modal isOpen onClose={() => {}} title="Brak wczorajszego raportu" size="md">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-limona-red/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-limona-red" />
          </div>
          <div className="space-y-2 text-sm text-limona-text">
            <p>
              Za <span className="text-limona-white font-medium capitalize">{dateLabel}</span> nie
              wpłynął Twój raport dzienny.
            </p>
            <p className="text-limona-text-muted">
              Raport domyka dzień pracy — dzięki niemu zespół widzi postępy bez dopytywania,
              a Ty zaczynasz kolejny dzień z czystym kontem.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 bg-limona-surface-2/50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="accent-limona-lime mt-0.5 cursor-pointer"
          />
          <span className="text-sm text-limona-text">
            Mam świadomość, że raport dzienny jest obowiązkowym elementem mojej pracy
            i zadbam, aby kolejne wpływały na czas.
          </span>
        </label>

        <p className="text-xs text-limona-text-dim">
          Potwierdzenie zostaje odnotowane i wlicza się do miesięcznego podsumowania braków raportów.
        </p>

        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={!acknowledged || saving}
            className="limona-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Zapisywanie...' : 'Potwierdzam'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
