'use client'

import { useState } from 'react'
import { Send, Pencil, Trash2, Check, X } from 'lucide-react'
import { useKontaktKomentarze } from '@/hooks/useKontaktKomentarze'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { sortByCreatedAt } from '@/lib/utils'

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
  const { komentarze, loading, addKomentarz, editKomentarz, deleteKomentarz } = useKontaktKomentarze(kontaktId)
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const isAdmin = profile?.role === 'admin'
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    await addKomentarz(newComment.trim())
    setNewComment('')
    setSending(false)
  }

  function startEdit(id: string, content: string) {
    setEditingId(id)
    setEditContent(content)
  }

  async function handleSaveEdit() {
    if (!editingId || !editContent.trim()) return
    setSavingEdit(true)
    const { error } = await editKomentarz(editingId, editContent.trim())
    setSavingEdit(false)
    if (error) { showToast(error, 'error'); return }
    setEditingId(null)
    setEditContent('')
  }

  async function handleDelete(id: string) {
    if (!confirm('Na pewno usunąć ten komentarz?')) return
    const { error } = await deleteKomentarz(id)
    if (error) showToast(error, 'error')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">
        Komentarze ({komentarze.length})
      </h3>

      {/* Add comment form — na górze, żeby nie scrollować pod długą listę */}
      <form onSubmit={handleSubmit} className="flex gap-2 pb-2 border-b border-limona-border">
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

      {/* Timeline — najnowsze u góry, długa lista przewija się we własnym oknie */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : komentarze.length === 0 ? (
        <p className="text-xs text-limona-text-dim text-center py-4">
          Brak komentarzy. Dodaj pierwszy wpis do osi czasu.
        </p>
      ) : (
        <div className="relative space-y-0 max-h-[60vh] overflow-y-auto pr-1">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-limona-border" />
          {sortByCreatedAt(komentarze, 'desc').map(k => {
            const canTouch = k.user_id === user?.id || isAdmin
            const isEditing = editingId === k.id
            return (
              <div key={k.id} className="flex gap-3 pb-4 relative group">
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
                    {k.updated_at && (
                      <span className="text-[10px] text-limona-text-dim italic">(edytowano)</span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {canTouch && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(k.id, k.content)}
                            className="p-0.5 text-limona-text-dim hover:text-limona-lime opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            title="Edytuj komentarz"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(k.id)}
                            className="p-0.5 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            title="Usuń komentarz"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                      <span className="text-[10px] text-limona-text-dim hidden sm:block">
                        {new Date(k.created_at).toLocaleString('pl-PL', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="limona-input w-full text-sm resize-y min-h-[60px]"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        maxLength={4000}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setEditContent('') }}
                          className="flex items-center gap-1 text-[11px] text-limona-text-muted hover:text-limona-white transition-colors"
                        >
                          <X size={11} /> Anuluj
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={savingEdit || !editContent.trim()}
                          className="flex items-center gap-1 text-[11px] text-limona-lime hover:text-limona-lime-hover disabled:opacity-40 transition-colors font-medium"
                        >
                          <Check size={11} /> {savingEdit ? 'Zapisywanie…' : 'Zapisz'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-limona-text whitespace-pre-wrap break-words">{k.content}</p>
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
