'use client'

import { memo } from 'react'
import { Building2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationBell } from '@/components/ui/NotificationBell'
import Link from 'next/link'

export const TopBar = memo(function TopBar() {
  const { user, profile } = useAuth()

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-limona-surface border-b border-limona-border h-14">
      <div className="flex items-center justify-between h-full px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Building2 size={20} className="text-limona-lime" />
          <span className="font-heading font-bold text-sm uppercase tracking-wide text-limona-white">Limona</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell userId={user?.id} />
          <Link href="/profil">
            <Avatar name={profile?.full_name || 'User'} url={profile?.avatar_url} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  )
})
