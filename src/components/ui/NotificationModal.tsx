'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'

interface NotifPayload {
  id: string
  user_id: string
  from_user_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
}

export function NotificationModal() {
  const [notif, setNotif] = useState<NotifPayload | null>(null)
  const [fromName, setFromName] = useState<string>('')
  const router = useRouter()

  const handleNotification = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as NotifPayload
    if (!detail) return

    // Check if user is focused on an input field — if so, don't show modal
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return
    }

    // Check if on calculator page — don't interrupt
    if (window.location.pathname.includes('/kalkulator')) {
      return
    }

    setNotif(detail)

    // Fetch from_user name
    if (detail.from_user_id) {
      fetch('/api/profiles').then(r => r.json()).then((profiles: { id: string; full_name: string }[]) => {
        const p = profiles.find(p => p.id === detail.from_user_id)
        if (p) setFromName(p.full_name)
      })
    }
  }, [])

  useEffect(() => {
    window.addEventListener('limona-notification', handleNotification)
    return () => window.removeEventListener('limona-notification', handleNotification)
  }, [handleNotification])

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!notif) return
    const timer = setTimeout(() => setNotif(null), 8000)
    return () => clearTimeout(timer)
  }, [notif])

  if (!notif) return null

  return (
    <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-top fade-in duration-300">
      <div className="limona-card border-l-[3px] border-l-limona-lime p-4 w-80 sm:w-96 shadow-lg shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-limona-lime/10 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-limona-lime" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold mb-1">
              Nowe powiadomienie
            </p>
            <p className="text-sm font-medium text-limona-white">{notif.title}</p>
            {notif.body && (
              <p className="text-xs text-limona-text-muted mt-1 line-clamp-2">{notif.body}</p>
            )}
            {fromName && (
              <p className="text-xs text-limona-text-dim mt-1">Od: {fromName}</p>
            )}
            {notif.link && (
              <button
                onClick={() => {
                  router.push(notif.link!)
                  setNotif(null)
                }}
                className="limona-btn-sm mt-3 text-[11px] py-1.5 px-3"
              >
                Przejdź
              </button>
            )}
          </div>
          <button
            onClick={() => setNotif(null)}
            className="p-1 text-limona-text-dim hover:text-limona-text-muted flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
