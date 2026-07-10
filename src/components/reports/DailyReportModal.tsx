'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Copy, Send } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import {
  buildReportText, OUTCOME_LABELS, REPORT_CATEGORIES, REPORT_CATEGORY_HEADERS,
} from '@/lib/reports'
import type { DailyReportData } from '@/lib/reports'
import { cn } from '@/lib/utils'

interface DailyReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitted?: () => void
  /** Podgląd cudzego raportu (panel admina/centrali) — wyłącza edycję */
  viewUserId?: string
  viewDate?: string
}

export function DailyReportModal({ isOpen, onClose, onSubmitted, viewUserId, viewDate }: DailyReportModalProps) {
  const { showToast } = useToast()
  const readOnly = !!viewUserId
  const [data, setData] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const taskNotesRef = useRef(taskNotes)
  useEffect(() => { taskNotesRef.current = taskNotes }, [taskNotes])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    const url = readOnly
      ? `/api/reports/daily?userId=${viewUserId}&date=${viewDate}`
      : '/api/reports/daily'
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then((d: DailyReportData | null) => {
        if (cancelled || !d) return
        setData(d)
        setContent(d.note.content)
        setTaskNotes(Object.fromEntries(d.dayTasks.map(t => [t.id, t.note])))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, readOnly, viewUserId, viewDate])

  const saveNote = useCallback((value: string) => {
    if (!data || readOnly) return
    fetch('/api/reports/daily/note', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: data.date, content: value, task_notes: taskNotesRef.current }),
    })
  }, [data, readOnly])
  const debouncedSave = useDebouncedCallback(saveNote as (...args: unknown[]) => void, 800)

  function handleContentChange(value: string) {
    setContent(value)
    debouncedSave(value)
  }

  function handleTaskNoteChange(taskId: string, value: string) {
    setTaskNotes(prev => ({ ...prev, [taskId]: value }))
    debouncedSave(content)
  }

  async function handleCopy() {
    if (!data) return
    const text = buildReportText({
      ...data,
      note: { ...data.note, content },
      dayTasks: data.dayTasks.map(t => ({ ...t, note: taskNotes[t.id] ?? '' })),
    })
    await navigator.clipboard.writeText(text)
    showToast('Raport skopiowany do schowka', 'success')
  }

  async function handleSubmit() {
    if (!data) return
    setSubmitting(true)
    // Dociśnij bieżącą treść przed stemplem przesłania
    await fetch('/api/reports/daily/note', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: data.date, content, task_notes: taskNotes }),
    })
    const res = await fetch('/api/reports/daily/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: data.date }),
    })
    setSubmitting(false)
    if (!res.ok) {
      showToast((await res.json()).error || 'Błąd przesyłania raportu', 'error')
      return
    }
    const { submitted_at } = await res.json()
    setData(d => d ? { ...d, note: { ...d.note, submitted_at } } : d)
    showToast('Raport dzienny przesłany', 'success')
    onSubmitted?.()
  }

  const submitted = !!data?.note.submitted_at
  const dateLabel = data
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={readOnly ? `Raport dzienny — ${data?.userName ?? ''}` : 'Raport dzienny'} size="xl">
      {loading || !data ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-limona-text-muted capitalize">{dateLabel}</p>
            {submitted ? (
              <span className="flex items-center gap-1.5 text-xs text-limona-green">
                <CheckCircle size={13} />
                Przesłano {new Date(data.note.submitted_at!).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : readOnly ? (
              <span className="text-xs text-limona-text-dim">Nie przesłano</span>
            ) : null}
          </div>

          {/* CEL DNIA — REALIZACJA (jedyne pole ręczne) */}
          <section>
            <h3 className="limona-eyebrow mb-2">Cel dnia — realizacja</h3>
            {readOnly ? (
              <p className="text-sm text-limona-text whitespace-pre-wrap">{content.trim() || '—'}</p>
            ) : (
              <textarea
                className="limona-input w-full min-h-[90px] resize-y text-sm"
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Twoje spostrzeżenia z dnia — reszta raportu składa się sama z zadań..."
              />
            )}
          </section>

          {/* SPISANA LISTA ZADAŃ DNIA — status + opcjonalna notatka per zadanie */}
          <section>
            <h3 className="limona-eyebrow mb-2">Zadania dnia ({data.dayTasks.length})</h3>
            {data.dayTasks.length === 0 ? (
              <p className="text-sm text-limona-text-dim">Brak zadań z terminem lub domkniętych tego dnia</p>
            ) : (
              <div className="space-y-2">
                {data.dayTasks.map(t => (
                  <div key={t.id} className="limona-card p-3 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Badge value={t.status} />
                      {t.due_time && <span className="text-[10px] font-mono text-limona-text-dim">{t.due_time.slice(0, 5)}</span>}
                      <span className="text-sm text-limona-text">{t.title}</span>
                      {t.property && (
                        <Link href={`/nieruchomosci/${t.property.id}`} className="text-xs text-limona-blue hover:underline">
                          {t.property.location}
                        </Link>
                      )}
                      {t.outcome && (
                        <span className={cn(
                          'text-[10px] uppercase tracking-wider font-bold',
                          t.outcome === 'zainteresowany' && 'text-limona-green',
                          t.outcome === 'oczekuje_na_materialy' && 'text-limona-yellow',
                          t.outcome === 'niezainteresowany' && 'text-limona-red',
                          t.outcome === 'brak_kontaktu' && 'text-limona-text-dim',
                        )}>
                          {OUTCOME_LABELS[t.outcome]}
                        </span>
                      )}
                    </div>
                    {readOnly ? (
                      (taskNotes[t.id] || '').trim() && (
                        <p className="text-xs text-limona-text-muted pl-1 border-l-2 border-limona-border">{taskNotes[t.id]}</p>
                      )
                    ) : (
                      <input
                        className="limona-input w-full text-xs py-1.5"
                        placeholder="Notatka do zadania (opcjonalnie)..."
                        value={taskNotes[t.id] ?? ''}
                        onChange={e => handleTaskNoteChange(t.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Liczniki per kategoria kontaktu */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REPORT_CATEGORIES.map(cat => {
              const c = data.categories[cat]
              return (
                <div key={cat} className="limona-card p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-limona-text-muted mb-2">
                    {REPORT_CATEGORY_HEADERS[cat]}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-limona-text-muted">Odwiedzono/kontakty</span>
                    <span className="font-mono text-right">{c?.total ?? 0}</span>
                    <span className="text-limona-text-muted">Zainteresowani</span>
                    <span className="font-mono text-right text-limona-green">{c?.zainteresowany ?? 0}</span>
                    <span className="text-limona-text-muted">Oczekują na materiały</span>
                    <span className="font-mono text-right text-limona-yellow">{c?.oczekuje_na_materialy ?? 0}</span>
                    <span className="text-limona-text-muted">Niezainteresowani</span>
                    <span className="font-mono text-right text-limona-red">{c?.niezainteresowany ?? 0}</span>
                  </div>
                </div>
              )
            })}
          </section>

          {/* NOWE TEMATY */}
          <section>
            <h3 className="limona-eyebrow mb-2">Nowe tematy ({data.newProperties.length})</h3>
            {data.newProperties.length === 0 ? (
              <p className="text-sm text-limona-text-dim">Brak nowych nieruchomości tego dnia</p>
            ) : (
              <div className="flex items-baseline gap-2 text-sm flex-wrap">
                {data.newProperties.map(p => (
                  <Link key={p.id} href={`/nieruchomosci/${p.id}`} className="text-limona-blue hover:underline text-xs">
                    {p.location}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* PLAN NA JUTRO */}
          <section>
            <h3 className="limona-eyebrow mb-2">Plan na jutro ({data.planTomorrow.length})</h3>
            {data.planTomorrow.length === 0 ? (
              <p className="text-sm text-limona-text-dim">Brak zadań z jutrzejszym terminem</p>
            ) : (
              <ul className="space-y-1.5">
                {data.planTomorrow.map(t => (
                  <li key={t.id} className="text-sm flex items-baseline gap-2 flex-wrap">
                    <span className="text-limona-text">{t.title}</span>
                    {t.property && (
                      <Link href={`/nieruchomosci/${t.property.id}`} className="text-xs text-limona-blue hover:underline">
                        {t.property.location}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Akcje */}
          <div className="flex gap-3 justify-end pt-2 border-t border-limona-border">
            <button onClick={handleCopy} className="limona-btn-outline flex items-center gap-2">
              <Copy size={14} />
              Kopiuj raport
            </button>
            {!readOnly && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="limona-btn flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Przesyłanie...' : submitted ? 'Prześlij ponownie' : 'Prześlij raport'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
