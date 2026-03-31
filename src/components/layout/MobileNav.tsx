'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Calculator, ListTodo, MessageSquare, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/nieruchomosci', icon: Building2, label: 'CRM' },
  { href: '/kalkulator', icon: Calculator, label: 'Kalk' },
  { href: '/zadania', icon: ListTodo, label: 'Zadania' },
  { href: '/wall', icon: MessageSquare, label: 'Wall' },
  { href: '/dashboard', icon: User, label: 'Profil' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-limona-surface border-t border-limona-border">
      <div className="flex items-center justify-around h-16 px-2 pb-safe">
        {tabs.map(tab => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors min-w-[64px]',
                isActive ? 'text-limona-lime' : 'text-limona-text-muted'
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] uppercase tracking-wider font-medium">
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
