'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Send, Pin, PinOff, Trash2, MessageSquare, Check } from 'lucide-react'
import { useWallContext } from '@/hooks/useWallProvider'
import type { WallMessage } from '@/hooks/useWall'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { parseMentions, parseTaskRefs, extractMentionedUserIds, isTaskVisibleToUser } from '@/lib/mentions'
import { createNotification } from '@/hooks/useNotifications'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

export default function WallPage() {
  const { user, profile } = useAuth()
  const { messages, loading, postMessage, deleteMessage, togglePin, markAsRead, isRead } = useWallContext()
  const { tasks } = useTasks()
  const { visibleIds } = useVisibleUserIds(user?.id, profile?.role)
  const { showToast } = useToast()
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])

  const isAdmin = profile?.role === 'admin'

  // Fetch all profiles for @mention lookup (once)
  const profilesFetched = useRef(false)
  useEffect(() => {
    if (profilesFetched.current) return
    profilesFetched.current = true
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
      setProfiles((data as Profile[]) || [])
    })
  }, [])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !user) return
    setSending(true)

    const { error, data: newMessage } = await postMessage(newMsg.trim(), user.id)
    if (error) { showToast(error, 'error'); setSending(false); return }

    // Send notifications for @mentions
    const mentionedIds = extractMentionedUserIds(newMsg, profiles)
    for (const mentionedUserId of mentionedIds) {
      if (mentionedUserId !== user.id) {
        await createNotification({
          userId: mentionedUserId,
          fromUserId: user.id,
          type: 'mention_wall',
          title: `${profile?.full_name || 'Ktoś'} oznaczył/a Cię na Wallu`,
          body: newMsg.trim().slice(0, 100),
          link: '/wall',
          referenceId: newMessage?.id,
        })
      }
    }

    setNewMsg('')
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

  async function handleMarkRead(msg: WallMessage) {
    if (!user) return
    await markAsRead(msg.id, user.id)
  }

  const pinned = useMemo(() => messages.filter(m => m.pinned), [messages])
  const regular = useMemo(() => messages.filter(m => !m.pinned), [messages])

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

  /**
   * Render message content with @mentions highlighted and #task references
   * rendered according to visibility rules.
   */
  const renderContent = useCallback(function renderContent(content: string) {
    const mentions = parseMentions(content, profiles)
    const taskRefs = parseTaskRefs(content, tasks)

    // Combine and sort all references by start position
    const allRefs = [
      ...mentions.map(m => ({ ...m, kind: 'mention' as const })),
      ...taskRefs.map(t => ({ ...t, kind: 'task' as const })),
    ].sort((a, b) => a.start - b.start)

    if (allRefs.length === 0) return <span>{content}</span>

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    allRefs.forEach((ref, i) => {
      // Text before this reference
      if (ref.start > lastIndex) {
        parts.push(<span key={`t${i}`}>{content.slice(lastIndex, ref.start)}</span>)
      }

      if (ref.kind === 'mention') {
        parts.push(
          <span key={`m${i}`} className="text-limona-lime font-medium">
            @{ref.name}
          </span>
        )
      } else {
        // Task reference — check visibility
        const task = ref.taskId ? tasks.find(t => t.id === ref.taskId) : null
        if (task && !isTaskVisibleToUser(task, user?.id || '', visibleIds)) {
          // Not visible — show redacted
          parts.push(
            <span key={`tr${i}`} className="text-limona-text-dim italic">
              #zadanie użytkownika {task.assignee?.full_name || task.created_by?.toString().slice(0, 8) || 'xyz'}
            </span>
          )
        } else {
          parts.push(
            <span key={`tr${i}`} className="text-limona-blue font-medium cursor-pointer hover:underline"
              onClick={() => { if (task) window.location.href = `/nieruchomosci/${task.property_id || ''}` }}>
              #{ref.taskTitle}
            </span>
          )
        }
      }

      lastIndex = ref.end
    })

    // Remaining text
    if (lastIndex < content.length) {
      parts.push(<span key="end">{content.slice(lastIndex)}</span>)
    }

    return <>{parts}</>
  }, [profiles, tasks, user?.id, visibleIds])

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Komunikacja</span>
        <h1 className="limona-heading text-3xl mt-1">Wall</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Kanał zespołowy — wiadomości trzymane 90 dni •{' '}
          <span className="text-limona-lime">@imię</span> aby oznaczyć •{' '}
          <span className="text-limona-blue">#&quot;nazwa zadania&quot;</span> aby odnieść się do zadania
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
              placeholder='Napisz do zespołu... (@Jan aby oznaczyć, #"Zadanie" aby odnieść)'
              maxLength={2000}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(e) }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-limona-text-dim">{newMsg.length}/2000</span>
              <button type="submit" disabled={sending || !newMsg.trim()} className="limona-btn-sm flex items-center gap-2 disabled:opacity-40">
                <Send size={14} /> Wyślij
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div>
          <h3 className="limona-eyebrow mb-3 flex items-center gap-2"><Pin size={12} /> Przypięte</h3>
          <div className="space-y-2">
            {pinned.map(msg => (
              <MessageCard key={msg.id} msg={msg} isOwn={msg.user_id === user?.id} isAdmin={isAdmin}
                onDelete={handleDelete} onPin={handlePin} onMarkRead={handleMarkRead}
                formatTime={formatTime} daysLeft={daysUntilExpiry(msg.created_at)}
                renderContent={renderContent} isReadByUser={isRead(msg.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : regular.length === 0 && pinned.length === 0 ? (
        <div className="limona-card p-12 text-center">
          <MessageSquare size={40} className="text-limona-text-dim mx-auto mb-4" />
          <p className="text-limona-text-muted">Brak wiadomości — napisz pierwszą!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regular.map(msg => (
            <MessageCard key={msg.id} msg={msg} isOwn={msg.user_id === user?.id} isAdmin={isAdmin}
              onDelete={handleDelete} onPin={handlePin} onMarkRead={handleMarkRead}
              formatTime={formatTime} daysLeft={daysUntilExpiry(msg.created_at)}
              renderContent={renderContent} isReadByUser={isRead(msg.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MessageCard({
  msg, isOwn, isAdmin, onDelete, onPin, onMarkRead,
  formatTime, daysLeft, renderContent, isReadByUser,
}: {
  msg: WallMessage; isOwn: boolean; isAdmin: boolean
  onDelete: (id: string) => void; onPin: (msg: WallMessage) => void
  onMarkRead: (msg: WallMessage) => void
  formatTime: (d: string) => string; daysLeft: number
  renderContent: (content: string) => React.ReactNode
  isReadByUser: boolean
}) {
  const canDelete = isOwn || isAdmin
  const canPin = isAdmin
  const showReadButton = !isOwn && !isReadByUser

  return (
    <div className={cn(
      'limona-card p-4 group',
      msg.pinned && 'border-l-[3px] border-l-limona-yellow',
      !isReadByUser && !isOwn && 'border-l-[3px] border-l-limona-lime'
    )}>
      <div className="flex gap-3">
        <Avatar name={msg.user?.full_name || 'Użytkownik'} url={msg.user?.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-limona-white">{msg.user?.full_name || 'Użytkownik'}</span>
            {msg.user?.role === 'admin' && (
              <span className="text-[9px] bg-limona-lime/20 text-limona-lime px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Admin</span>
            )}
            <span className="text-xs text-limona-text-dim">{formatTime(msg.created_at)}</span>
            {msg.pinned && <Pin size={10} className="text-limona-yellow" />}
            {isReadByUser && !isOwn && (
              <span className="text-[9px] text-limona-green flex items-center gap-0.5">
                <Check size={9} /> przeczytane
              </span>
            )}
          </div>
          <p className="text-sm text-limona-text mt-1.5 whitespace-pre-wrap break-words">
            {renderContent(msg.content)}
          </p>
          {daysLeft <= 7 && !msg.pinned && (
            <p className="text-[10px] text-limona-red mt-2">Wygasa za {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {showReadButton && (
            <button onClick={() => onMarkRead(msg)}
              className="p-1.5 text-limona-text-dim hover:text-limona-green transition-colors" title="Oznacz jako przeczytane">
              <Check size={14} />
            </button>
          )}
          {canPin && (
            <button onClick={() => onPin(msg)}
              className="p-1.5 text-limona-text-dim hover:text-limona-yellow transition-colors" title={msg.pinned ? 'Odepnij' : 'Przypnij'}>
              {msg.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(msg.id)}
              className="p-1.5 text-limona-text-dim hover:text-limona-red transition-colors" title="Usuń">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
