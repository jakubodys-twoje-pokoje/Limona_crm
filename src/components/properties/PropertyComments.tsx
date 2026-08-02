'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, MessageSquare, Pencil, Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { SortToggle } from '@/components/ui/SortToggle'
import { sortByCreatedAt, type SortDirection } from '@/lib/utils'

interface PropertyComment {
  id: string
  property_id: string
  user_id: string | null
  content: string
  created_at: string
  updated_at?: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

interface PropertyCommentsProps {
  propertyId: string
  userId: string
  isAdmin?: boolean
}

/**
 * Ogólny wątek komentarzy nieruchomości — na bieżąco co się dzieje w temacie,
 * co ustalono, nowe informacje. Zawiera też automatyczne wpisy z uzasadnień
 * zmiany statusu (dłużnika/inwestora), więc to jeden spójny dziennik nieruchomości.
 */
export function PropertyComments({ propertyId, userId, isAdmin }: PropertyCommentsProps) {
  const [comments, setComments] = useState<PropertyComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/comments`)
    if (res.ok) setComments(await res.json())
    setLoading(false)
  }, [propertyId])

  useEffect(() => { fetchComments() }, [fetchComments])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    const res = await fetch(`/api/properties/${propertyId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    })
    if (res.ok) { setNewComment(''); fetchComments() }
    setSending(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/properties/${propertyId}/comments/${id}`, { method: 'DELETE' })
    if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
  }

  async function saveEdit(id: string) {
    const content = editingContent.trim()
    if (!content) return
    const res = await fetch(`/api/properties/${propertyId}/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      const updated = await res.json()
      setComments(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
      setEditingId(null)
      setEditingContent('')
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'teraz'
    if (mins < 60) return `${mins}m temu`
    if (hours < 24) return `${hours}h temu`
    if (days < 7) return `${days}d temu`
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const sorted = sortByCreatedAt(comments, sortDir)

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="limona-card-accent p-4 space-y-3">
        <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">Nowy komentarz</p>
        <textarea
          className="limona-input w-full min-h-[60px] resize-y text-sm"
          placeholder="Co się dzieje w temacie, co ustaliłaś/eś, nowe informacje..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
        />
        <button type="submit" disabled={sending || !newComment.trim()} className="limona-btn-sm disabled:opacity-40">
          {sending ? 'Dodawanie...' : 'Dodaj komentarz'}
        </button>
      </form>

      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">
          Komentarze ({comments.length})
        </h4>
        {comments.length > 1 && <SortToggle dir={sortDir} onToggle={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} />}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={32} className="text-limona-text-dim mx-auto mb-3" />
          <p className="text-limona-text-muted">Brak komentarzy — dodaj pierwszy powyżej</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(comment => {
            const canEdit = comment.user_id === userId || isAdmin
            const edited = comment.updated_at && comment.updated_at !== comment.created_at
            return (
            <div key={comment.id} className="flex gap-2">
              <Avatar name={comment.user?.full_name || 'Użytkownik'} url={comment.user?.avatar_url} size="sm" />
              <div className="flex-1 min-w-0 bg-limona-surface-2/50 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-limona-white">{comment.user?.full_name || 'Użytkownik'}</span>
                  <span className="text-[10px] text-limona-text-dim">{formatTime(comment.created_at)}{edited && ' · edytowano'}</span>
                  {canEdit && editingId !== comment.id && (
                    <div className="ml-auto flex items-center gap-0.5">
                      <button onClick={() => { setEditingId(comment.id); setEditingContent(comment.content) }}
                        className="p-1 text-limona-text-dim hover:text-limona-lime transition-colors" title="Edytuj">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(comment.id)}
                        className="p-1 text-limona-text-dim hover:text-limona-red transition-colors" title="Usuń">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea className="limona-input w-full text-sm min-h-[56px] resize-y"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)} autoFocus />
                    <div className="flex gap-1.5">
                      <button onClick={() => saveEdit(comment.id)} disabled={!editingContent.trim()}
                        className="limona-btn-sm text-xs flex items-center gap-1 disabled:opacity-40">
                        <Check size={12} /> Zapisz
                      </button>
                      <button onClick={() => { setEditingId(null); setEditingContent('') }}
                        className="limona-btn-outline text-xs px-3 py-1.5 flex items-center gap-1">
                        <X size={12} /> Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-limona-text mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
