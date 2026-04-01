'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Calculator, ListTodo, MessageSquare, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWall } from '@/hooks/useWall'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/nieruchomosci', icon: Building2, label: 'CRM' },
  { href: '/kalkulator', icon: Calculator, label: 'Kalk' },
  { href: '/zadania', icon: ListTodo, label: 'Zadania' },
  { href: '/wall', icon: MessageSquare, label: 'Wall', showCounter: true },
  { href: '/profil', icon: User, label: 'Profil' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { unreadCount } = useWall(user?.id)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-limona-surface border-t border-limona-border">
      <div className="flex items-center justify-around h-16 px-2 pb-safe">
        {tabs.map(tab => {
          const isActive = pathname.startsWith(tab.href)
          const counter = 'showCounter' in tab && tab.showCounter ? unreadCount : 0
          return (
            <Link key={tab.href} href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors min-w-[64px] relative',
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
              <span className="text-[10px] uppercase tracking-wider font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
