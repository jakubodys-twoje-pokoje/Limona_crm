'use client'

import { useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useTaskComments } from '@/hooks/useTaskComments'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface TaskCommentsProps {
  taskId: string
  userId: string
  isAdmin?: boolean
}

export function TaskComments({ taskId, userId, isAdmin }: TaskCommentsProps) {
  const { comments, loading, addComment, deleteComment } = useTaskComments(taskId)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    await addComment(newComment.trim(), userId)
    setNewComment('')
    setSending(false)
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

  return (
    <div className="space-y-3">
      <h4 className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">
        Komentarze ({comments.length})
      </h4>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2 group">
              <Avatar
                name={comment.user?.full_name || 'Użytkownik'}
                url={comment.user?.avatar_url}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-limona-white">
                    {comment.user?.full_name || 'Użytkownik'}
                  </span>
                  <span className="text-[10px] text-limona-text-dim">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-limona-text mt-0.5 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
              {(comment.user_id === userId || isAdmin) && (
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="p-1 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-limona-text-dim text-center py-2">Brak komentarzy</p>
          )}
        </div>
      )}

      {/* Add comment */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="limona-input flex-1 text-xs py-2"
          placeholder="Dodaj komentarz..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={sending || !newComment.trim()}
          className="p-2 text-limona-text-muted hover:text-limona-lime disabled:opacity-30 transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
