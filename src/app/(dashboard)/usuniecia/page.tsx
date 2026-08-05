'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ShieldAlert, ExternalLink, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { canReviewDeletions, DELETION_ENTITY_LABELS } from '@/lib/deletion'
import { cn } from '@/lib/utils'
import type { DeletionRequest } from '@/types/database'

const ENTITY_ACCENT: Record<string, string> = {
  lead: 'text-limona-lime bg-limona-lime/10',
  kontakt: 'text-limona-blue bg-limona-blue/10',
  property: 'text-limona-yellow bg-limona-yellow/10',
}

function entityHref(r: DeletionRequest): string {
  if (r.entity_type === 'lead') return `/leady?open=${r.entity_id}`
  if (r.entity_type === 'kontakt') return `/kontakty/${r.entity_id}`
  return `/nieruchomosci/${r.entity_id}`
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'teraz'
  if (mins < 60) return `${mins} min temu`
  if (mins < 1440) return `${Math.floor(mins / 60)} godz. temu`
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

export default function UsunieciaPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const confirmDialog = useConfirm()
  const canReview = canReviewDeletions(profile?.role)

  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/deletion-requests')
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Dostęp tylko dla centrali (admin / kierownik centrali)
  useEffect(() => {
    if (!authLoading && profile && !canReview) router.replace('/dashboard')
  }, [authLoading, profile, canReview, router])

  async function decide(req: DeletionRequest, action: 'approve' | 'reject') {
    if (action === 'approve') {
      const ok = await confirmDialog({
        message: `Zatwierdzić usunięcie „${req.entity_label ?? DELETION_ENTITY_LABELS[req.entity_type]}"? Rekord zostanie trwale usunięty.`,
        confirmLabel: 'Usuń rekord',
      })
      if (!ok) return
    }
    setBusyId(req.id)
    const res = await fetch(`/api/deletion-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: notes[req.id] || null }),
    })
    setBusyId(null)
    if (!res.ok) {
      showToast((await res.json()).error || 'Błąd', 'error')
      return
    }
    showToast(action === 'approve' ? 'Rekord usunięty' : 'Prośba odrzucona', 'success')
    setNotes(n => { const c = { ...n }; delete c[req.id]; return c })
    load()
  }

  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')

  if (authLoading || !canReview) return null

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <span className="limona-eyebrow">Centrala</span>
        <h1 className="limona-heading text-3xl mt-1">Prośby o usunięcie</h1>
        <p className="text-sm text-limona-text-muted mt-1">
          Użytkownicy zgłaszają rekordy do usunięcia z uzasadnieniem — tu je zatwierdzasz albo odrzucasz.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          {/* Oczekujące */}
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-limona-text-muted">
              <ShieldAlert size={14} /> Oczekujące ({pending.length})
            </p>
            {pending.length === 0 ? (
              <p className="text-sm text-limona-text-dim py-6 text-center limona-card">Brak oczekujących próśb 🎉</p>
            ) : (
              pending.map(req => (
                <div key={req.id} className="limona-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', ENTITY_ACCENT[req.entity_type])}>
                          {DELETION_ENTITY_LABELS[req.entity_type]}
                        </span>
                        <span className="text-sm font-medium text-limona-white truncate">{req.entity_label ?? '—'}</span>
                        <Link href={entityHref(req)} className="text-limona-text-dim hover:text-limona-lime transition-colors" title="Otwórz rekord">
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                      <p className="text-sm text-limona-text mt-1.5 whitespace-pre-wrap break-words">{req.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-limona-text-dim">
                    {req.requester && <Avatar name={req.requester.full_name} url={req.requester.avatar_url} size="sm" />}
                    <span>{req.requester?.full_name ?? 'Użytkownik'}</span>
                    <span>· {timeAgo(req.created_at)}</span>
                  </div>

                  <input
                    className="limona-input text-xs py-2 w-full"
                    placeholder="Notatka do decyzji (opcjonalnie — trafi do zgłaszającego)"
                    value={notes[req.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                  />

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => decide(req, 'reject')}
                      disabled={busyId === req.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider border border-limona-border text-limona-text-muted hover:text-limona-white hover:border-limona-text-muted transition-colors disabled:opacity-50"
                    >
                      <X size={13} /> Odrzuć
                    </button>
                    <button
                      onClick={() => decide(req, 'approve')}
                      disabled={busyId === req.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider bg-limona-red/90 text-white hover:bg-limona-red transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Zatwierdź i usuń
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Historia rozpatrzonych */}
          {decided.length > 0 && (
            <div className="space-y-2 pt-2">
              <button onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-text-muted hover:text-limona-text transition-colors">
                {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Rozpatrzone ({decided.length})
              </button>
              {showHistory && (
                <div className="space-y-2">
                  {decided.map(req => (
                    <div key={req.id} className="limona-card p-3 flex items-start gap-3 opacity-90">
                      <span className={cn('mt-0.5 flex-shrink-0', req.status === 'approved' ? 'text-limona-red' : 'text-limona-text-dim')}>
                        {req.status === 'approved' ? <Check size={15} /> : <X size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full', ENTITY_ACCENT[req.entity_type])}>
                            {DELETION_ENTITY_LABELS[req.entity_type]}
                          </span>
                          <span className="text-sm text-limona-text truncate">{req.entity_label ?? '—'}</span>
                          <span className={cn('text-[10px] uppercase tracking-wider font-bold', req.status === 'approved' ? 'text-limona-red' : 'text-limona-text-dim')}>
                            {req.status === 'approved' ? 'usunięto' : 'odrzucono'}
                          </span>
                        </div>
                        <p className="text-xs text-limona-text-dim mt-0.5 truncate">{req.reason}</p>
                        {req.review_note && <p className="text-[11px] text-limona-text-muted mt-0.5">Decyzja: {req.review_note}</p>}
                        <p className="text-[10px] text-limona-text-dim mt-0.5">
                          {req.requester?.full_name ?? 'Użytkownik'}
                          {req.reviewer && <> · rozpatrzył/a {req.reviewer.full_name}</>}
                          {req.reviewed_at && <> · {timeAgo(req.reviewed_at)}</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
