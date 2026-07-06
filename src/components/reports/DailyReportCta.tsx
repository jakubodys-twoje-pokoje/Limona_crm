'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, FileText } from 'lucide-react'
import { DailyReportModal } from '@/components/reports/DailyReportModal'
import { cn } from '@/lib/utils'

type Tone = 'green' | 'yellow' | 'red'

// Kolor presji czasowej: do 15 zielony, 15–17 żółty, 17–4 rano czerwony
function currentTone(): Tone {
  const h = new Date().getHours()
  if (h >= 4 && h < 15) return 'green'
  if (h >= 15 && h < 17) return 'yellow'
  return 'red'
}

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-limona-green text-black hover:opacity-90',
  yellow: 'bg-limona-yellow text-black hover:opacity-90',
  red: 'bg-limona-red text-white hover:opacity-90',
}

interface DailyReportCtaProps {
  /** Ikona zamiast pełnego przycisku (mobile TopBar) */
  compact?: boolean
}

export function DailyReportCta({ compact = false }: DailyReportCtaProps) {
  const [tone, setTone] = useState<Tone>(currentTone())
  const [submitted, setSubmitted] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)

  const refreshStatus = useCallback(() => {
    fetch('/api/reports/daily/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSubmitted(d.submitted) })
  }, [])

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(() => setTone(currentTone()), 60_000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  const done = submitted === true

  return (
    <>
      {compact ? (
        <button
          onClick={() => setShowModal(true)}
          title={done ? 'Raport dzienny przesłany' : 'Prześlij raport dzienny'}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-all',
            done ? 'bg-limona-surface-2 text-limona-green' : TONE_CLASSES[tone]
          )}
        >
          {done ? <CheckCircle size={16} /> : <FileText size={16} />}
        </button>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg',
            done
              ? 'bg-limona-surface-2 text-limona-green border border-limona-green/30'
              : TONE_CLASSES[tone]
          )}
        >
          {done ? <CheckCircle size={14} /> : <FileText size={14} />}
          {done ? 'Raport przesłany' : 'Prześlij raport dzienny'}
        </button>
      )}

      <DailyReportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmitted={refreshStatus}
      />
    </>
  )
}
