'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  userId: string | undefined
}

const typeLabels: Record<string, string> = {
  mention_wall: 'Oznaczenie na Wallu',
  mention_task: 'Oznaczenie w zadaniu',
  task_assigned: 'Przypisano zadanie',
  comment_added: 'Nowy komentarz',
}

const typeColors: Record<string, string> = {
  mention_wall: 'text-limona-lime',
  mention_task: 'text-limona-blue',
  task_assigned: 'text-limona-yellow',
  comment_added: 'text-limona-text-muted',
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification } = useNotifications(userId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(notif: Notification) {
    markAsRead(notif.id)
    if (notif.link) {
      router.push(notif.link)
      setOpen(false)
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
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    if (days < 30) return `${days}d`
    return d.toLocaleDateString('pl-PL')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-limona-text-muted hover:text-limona-lime transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-limona-red rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden bg-limona-surface border border-limona-border rounded shadow-lg z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-limona-border">
            <h3 className="text-xs uppercase tracking-wider font-bold text-limona-text-muted">
              Powiadomienia {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-limona-text-dim hover:text-limona-lime transition-colors uppercase tracking-wider px-2 py-1"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-limona-text-dim hover:text-limona-text-muted"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <p className="text-center text-limona-text-dim text-sm py-8">
                Brak powiadomień
              </p>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={cn(
                    'flex gap-3 p-3 border-b border-limona-border/50 hover:bg-limona-surface-2/50 cursor-pointer transition-colors group',
                    !notif.read && 'bg-limona-lime/5'
                  )}
                  onClick={() => handleNotificationClick(notif)}
                >
                  {notif.from_user ? (
                    <Avatar name={notif.from_user.full_name} url={notif.from_user.avatar_url} size="sm" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-limona-border flex items-center justify-center">
                      <Bell size={12} className="text-limona-text-dim" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] uppercase tracking-wider font-bold', typeColors[notif.type])}>
                        {typeLabels[notif.type]}
                      </span>
                      <span className="text-[10px] text-limona-text-dim">{formatTime(notif.created_at)}</span>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 bg-limona-lime rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-limona-white mt-0.5 truncate">{notif.title}</p>
                    {notif.body && (
                      <p className="text-xs text-limona-text-muted mt-0.5 truncate">{notif.body}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id) }}
                    className="p-1 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
