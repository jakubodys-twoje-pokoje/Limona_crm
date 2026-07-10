'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canManageTeams } from '@/lib/roles'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { DailyReportModal } from '@/components/reports/DailyReportModal'
import { cn } from '@/lib/utils'

interface TeamReportRow {
  id: string
  full_name: string
  avatar_url: string | null
  submitted: boolean
  submitted_at: string | null
  hasDraft: boolean
  taskCounts: { total: number; done: number }
  missedThisMonth: number
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RaportyPage() {
  const { profile } = useAuth()
  const allowed = canManageTeams(profile?.role)

  const [date, setDate] = useState(() => toDateKey(new Date()))
  const [rows, setRows] = useState<TeamReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<TeamReportRow | null>(null)

  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    fetch(`/api/reports/daily/team?date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRows(d.rows) })
      .finally(() => setLoading(false))
  }, [allowed, date])

  function shiftDay(n: number) {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() + n)
    setDate(toDateKey(d))
  }

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const submittedCount = rows.filter(r => r.submitted).length

  if (!allowed) {
    return (
      <div className="limona-card p-8 text-center max-w-md mx-auto mt-12">
        <h1 className="limona-heading text-2xl mb-2">Brak dostępu</h1>
        <p className="text-limona-text-muted text-sm">Ta strona jest dostępna tylko dla administratorów i kierownika centrali.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="limona-eyebrow">Nadzór</span>
        <h1 className="limona-heading text-3xl mt-1">Raporty dzienne</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Przegląd raportów całego zespołu — {submittedCount}/{rows.length} przesłanych
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => shiftDay(-1)} className="p-2 text-limona-text-muted hover:text-limona-white rounded hover:bg-limona-surface-2 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <h2 className="font-heading font-bold text-lg text-limona-white capitalize">{dateLabel}</h2>
          <input
            type="date"
            className="limona-input text-xs py-1.5 w-auto"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <button onClick={() => shiftDay(1)} className="p-2 text-limona-text-muted hover:text-limona-white rounded hover:bg-limona-surface-2 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="limona-card p-4 lg:p-6">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-limona-text-dim text-sm py-8">Brak userów do wyświetlenia</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => (
              <button
                key={r.id}
                onClick={() => setViewing(r)}
                className="w-full flex items-center gap-3 p-3 rounded hover:bg-limona-surface-2 transition-colors text-left"
              >
                <Avatar name={r.full_name} url={r.avatar_url} size="sm" />
                <span className="flex-1 text-sm font-medium text-limona-text">{r.full_name}</span>
                {r.missedThisMonth > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-limona-red/15 text-limona-red whitespace-nowrap"
                    title="Potwierdzone braki raportu dziennego w tym miesiącu"
                  >
                    <AlertTriangle size={10} />
                    {r.missedThisMonth} {r.missedThisMonth === 1 ? 'brak' : 'braki'} w miesiącu
                  </span>
                )}
                <span className="text-xs text-limona-text-dim font-mono hidden sm:inline">
                  {r.taskCounts.done}/{r.taskCounts.total} zadań
                </span>
                {r.submitted ? (
                  <span className="flex items-center gap-1.5 text-xs text-limona-green">
                    <CheckCircle size={13} />
                    {r.submitted_at && new Date(r.submitted_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : r.hasDraft ? (
                  <span className="flex items-center gap-1.5 text-xs text-limona-yellow">
                    <Clock size={13} /> Szkic
                  </span>
                ) : (
                  <span className={cn('flex items-center gap-1.5 text-xs', date < toDateKey(new Date()) ? 'text-limona-red' : 'text-limona-text-dim')}>
                    <XCircle size={13} /> Brak
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <DailyReportModal
          isOpen={!!viewing}
          onClose={() => setViewing(null)}
          viewUserId={viewing.id}
          viewDate={date}
        />
      )}
    </div>
  )
}
