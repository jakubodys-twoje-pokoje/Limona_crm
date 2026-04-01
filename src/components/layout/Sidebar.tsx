'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Calculator, ListTodo, MessageSquare, Users, UserCog, User, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWall } from '@/hooks/useWall'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/nieruchomosci', icon: Building2, label: 'Nieruchomości' },
  { href: '/kalkulator', icon: Calculator, label: 'Kalkulator' },
  { href: '/zadania', icon: ListTodo, label: 'Zadania' },
  { href: '/wall', icon: MessageSquare, label: 'Wall', showCounter: true },
  { href: '/zespol', icon: Users, label: 'Zespół' },
]

const adminItems = [
  { href: '/admin', icon: UserCog, label: 'Użytkownicy' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useWall(user?.id)
  const isAdmin = profile?.role === 'admin'

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])]

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-limona-surface border-r border-limona-border fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-limona-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-limona-lime/10 flex items-center justify-center">
            <Building2 size={22} className="text-limona-lime" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg uppercase tracking-wide text-limona-white leading-none">Limona</h1>
            <span className="text-[10px] uppercase tracking-[0.2em] text-limona-text-muted">CRM</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {allItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          const counter = 'showCounter' in item && item.showCounter ? unreadCount : 0
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded text-sm uppercase tracking-wider font-medium transition-all duration-200',
                isActive ? 'bg-limona-lime/10 text-limona-lime border-l-2 border-limona-lime'
                  : 'text-limona-text-muted hover:text-limona-white hover:bg-limona-surface-2'
              )}>
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {counter > 0 && (
                <span className="w-5 h-5 bg-limona-lime rounded-full text-[10px] font-bold text-black flex items-center justify-center">
                  {counter > 9 ? '9+' : counter}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-limona-border">
        <div className="flex items-center gap-3 mb-3">
          <NotificationBell userId={user?.id} />
          <Link href="/profil" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <Avatar name={profile?.full_name || 'User'} url={profile?.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-limona-white truncate">{profile?.full_name || 'Użytkownik'}</p>
              <p className="text-xs text-limona-text-dim truncate">{profile?.role || 'user'}</p>
            </div>
          </Link>
        </div>
        <button onClick={signOut}
          className="flex items-center gap-2 text-xs text-limona-text-muted hover:text-limona-red transition-colors uppercase tracking-wider w-full px-2 py-1">
          <LogOut size={14} /> Wyloguj się
        </button>
      </div>
    </aside>
  )
}
