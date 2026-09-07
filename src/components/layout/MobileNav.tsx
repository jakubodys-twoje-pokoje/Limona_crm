'use client'

import { memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LayoutDashboard, ListTodo, MessageSquare, Map, BookUser, Inbox } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWallContext } from '@/hooks/useWallProvider'
import { isDzialPrawny } from '@/lib/roles'
import { cn } from '@/lib/utils'

// Profil jest dostępny przez avatar w górnym pasku, więc w dolnym pasku
// zamiast niego jest skrót do Mapy (częściej używany w terenie).
const tabs = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Home' },
  { href: '/komunikacja',   icon: MessageSquare,   label: 'Kom.', showCounter: true },
  // Na telefonie zadania otwierają się od razu w Terminarzu (kanban dostępny przyciskiem)
  { href: '/zadania/kalendarz', icon: ListTodo,    label: 'Zadania', activePrefix: '/zadania' },
  { href: '/kontakty',      icon: BookUser,        label: 'Kontakty' },
  { href: '/nieruchomosci', icon: Building2,       label: 'Nieru.' },
  { href: '/leady',         icon: Inbox,           label: 'Leady' },
  { href: '/mapa',          icon: Map,             label: 'Mapa' },
]

// Dział prawny ma w aplikacji tylko Zadania i Nieruchomości
const DZIAL_PRAWNY_TABS = ['/zadania/kalendarz', '/nieruchomosci']

export const MobileNav = memo(function MobileNav() {
  const pathname = usePathname()
  const { user, profile } = useAuth()
  const { unreadCount } = useWallContext()
  const visibleTabs = isDzialPrawny(profile?.role)
    ? tabs.filter(t => DZIAL_PRAWNY_TABS.includes(t.href))
    : tabs

  return (
    <nav className="lg:hidden flex-shrink-0 z-50 bg-limona-surface border-t border-limona-border">
      <div className="flex items-center justify-around h-16 px-1">
        {visibleTabs.map(tab => {
          const isActive = pathname.startsWith('activePrefix' in tab && tab.activePrefix ? tab.activePrefix : tab.href)
          const counter = 'showCounter' in tab && tab.showCounter ? unreadCount : 0
          return (
            <Link key={tab.href} href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors min-w-0 relative',
                isActive ? 'text-limona-lime' : 'text-limona-text-muted'
              )}>
              <div className="relative">
                <tab.icon size={20} />
                {counter > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-limona-lime rounded-full text-[8px] font-bold text-black flex items-center justify-center">
                    {counter > 9 ? '9+' : counter}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
})
