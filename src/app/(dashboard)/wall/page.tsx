'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { Send, Pin, PinOff, Trash2, MessageSquare } from 'lucide-react'
import { useWall, type WallMessage } from '@/hooks/useWall'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

export default function WallPage() {
  const { messages, loading, postMessage, deleteMessage, togglePin } = useWall()
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isAdmin = profile?.role === 'admin'

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !user) return
    setSending(true)
    const { error } = await postMessage(newMsg.trim(), user.id)
    if (error) showToast(error, 'error')
    else setNewMsg('')
    setSending(false)
  }

  async function handleDelete(id: string) {
    const { error } = await deleteMessage(id)
    if (error) showToast(error, 'error')
  }

  async function handlePin(msg: WallMessage) {
    const { error } = await togglePin(msg.id, msg.pinned)
    if (error) showToast(error, 'error')
  }

  // Pinned messages
  const pinned = messages.filter(m => m.pinned)
  const regular = messages.filter(m => !m.pinned)

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
    return d.toLocaleDateString('pl-PL')
  }

  function daysUntilExpiry(dateStr: string): number {
    const d = new Date(dateStr)
    const expiry = new Date(d.getTime() + 90 * 86400000)
    return Math.ceil((expiry.getTime() - Date.now()) / 86400000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Komunikacja</span>
        <h1 className="limona-heading text-3xl mt-1">Wall</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Kanał zespołowy — wiadomości trzymane 90 dni
        </p>
      </div>

      {/* Compose */}
      <form onSubmit={handlePost} className="limona-card p-4">
        <div className="flex gap-3">
          {profile && <Avatar name={profile.full_name} url={profile.avatar_url} size="md" />}
          <div className="flex-1">
            <textarea
              className="limona-input min-h-[60px] resize-none"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="Napisz do zespołu..."
              maxLength={2000}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handlePost(e)
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-limona-text-dim">
                {newMsg.length}/2000 • Enter wysyła, Shift+Enter nowa linia
              </span>
              <button
                type="submit"
                disabled={sending || !newMsg.trim()}
                className="limona-btn-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Send size={14} />
                Wyślij
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Pinned messages */}
      {pinned.length > 0 && (
        <div>
          <h3 className="limona-eyebrow mb-3 flex items-center gap-2">
            <Pin size={12} />
            Przypięte
          </h3>
          <div className="space-y-2">
            {pinned.map(msg => (
              <MessageCard
                key={msg.id}
                msg={msg}
                isOwn={msg.user_id === user?.id}
                isAdmin={isAdmin}
                onDelete={handleDelete}
                onPin={handlePin}
                formatTime={formatTime}
                daysLeft={daysUntilExpiry(msg.created_at)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : regular.length === 0 && pinned.length === 0 ? (
        <div className="limona-card p-12 text-center">
          <MessageSquare size={40} className="text-limona-text-dim mx-auto mb-4" />
          <p className="text-limona-text-muted">Brak wiadomości — napisz pierwszą!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regular.map(msg => (
            <MessageCard
              key={msg.id}
              msg={msg}
              isOwn={msg.user_id === user?.id}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onPin={handlePin}
              formatTime={formatTime}
              daysLeft={daysUntilExpiry(msg.created_at)}
            />
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function MessageCard({
  msg,
  isOwn,
  isAdmin,
  onDelete,
  onPin,
  formatTime,
  daysLeft,
}: {
  msg: WallMessage
  isOwn: boolean
  isAdmin: boolean
  onDelete: (id: string) => void
  onPin: (msg: WallMessage) => void
  formatTime: (d: string) => string
  daysLeft: number
}) {
  const canDelete = isOwn || isAdmin
  const canPin = isAdmin

  return (
    <div className={cn(
      'limona-card p-4 group',
      msg.pinned && 'border-l-[3px] border-l-limona-yellow'
    )}>
      <div className="flex gap-3">
        <Avatar
          name={msg.user?.full_name || 'Użytkownik'}
          url={msg.user?.avatar_url}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-limona-white">
              {msg.user?.full_name || 'Użytkownik'}
            </span>
            {msg.user?.role === 'admin' && (
              <span className="text-[9px] bg-limona-lime/20 text-limona-lime px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Admin
              </span>
            )}
            <span className="text-xs text-limona-text-dim">{formatTime(msg.created_at)}</span>
            {msg.pinned && (
              <Pin size={10} className="text-limona-yellow" />
            )}
          </div>
          <p className="text-sm text-limona-text mt-1.5 whitespace-pre-wrap break-words">
            {msg.content}
          </p>
          {daysLeft <= 7 && !msg.pinned && (
            <p className="text-[10px] text-limona-red mt-2">
              Wygasa za {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {canPin && (
            <button
              onClick={() => onPin(msg)}
              className="p-1.5 text-limona-text-dim hover:text-limona-yellow transition-colors"
              title={msg.pinned ? 'Odepnij' : 'Przypnij'}
            >
              {msg.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1.5 text-limona-text-dim hover:text-limona-red transition-colors"
              title="Usuń"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
