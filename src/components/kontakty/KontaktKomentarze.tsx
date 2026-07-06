'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { useKontaktKomentarze } from '@/hooks/useKontaktKomentarze'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'

interface Props {
  kontaktId: string
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  if (mins  < 1)  return 'teraz'
  if (mins  < 60) return `${mins}m temu`
  if (hours < 24) return `${hours}h temu`
  if (days  < 7)  return `${days}d temu`
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function KontaktKomentarze({ kontaktId }: Props) {
  const { komentarze, loading, addKomentarz } = useKontaktKomentarze(kontaktId)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    await addKomentarz(newComment.trim())
    setNewComment('')
    setSending(false)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">
        Komentarze ({komentarze.length})
      </h3>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : komentarze.length === 0 ? (
        <p className="text-xs text-limona-text-dim text-center py-4">
          Brak komentarzy. Dodaj pierwszy wpis do osi czasu.
        </p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-limona-border" />
          {komentarze.map((k, i) => (
            <div key={k.id} className="flex gap-3 pb-4 relative">
              {/* Avatar sits on the line */}
              <div className="flex-shrink-0 w-8 z-10">
                <Avatar
                  name={k.user?.full_name || 'Użytkownik'}
                  url={k.user?.avatar_url ?? null}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0 bg-limona-surface-2 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-limona-white">
                    {k.user?.full_name || 'Użytkownik'}
                  </span>
                  <span className="text-[10px] text-limona-text-dim">
                    {formatTime(k.created_at)}
                  </span>
                  <span className="text-[10px] text-limona-text-dim ml-auto hidden sm:block">
                    {new Date(k.created_at).toLocaleString('pl-PL', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-sm text-limona-text whitespace-pre-wrap break-words">{k.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-limona-border">
        <textarea
          className="limona-input flex-1 text-sm resize-none"
          rows={2}
          placeholder="Dodaj wpis do osi czasu…"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          maxLength={4000}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              handleSubmit(e as unknown as React.FormEvent)
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !newComment.trim()}
          className="self-end p-2 text-limona-text-muted hover:text-limona-lime disabled:opacity-30 transition-colors"
          title="Dodaj (Ctrl+Enter)"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
