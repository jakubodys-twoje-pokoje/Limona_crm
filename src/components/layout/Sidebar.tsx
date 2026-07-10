'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, Building2, ListTodo, MessageSquare, Users, UserCog, User, LogOut, BookUser, MapPin, Inbox, CalendarDays, ChevronDown, Landmark, Gavel, Briefcase, Users2, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWallContext } from '@/hooks/useWallProvider'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface NavChild { href: string; icon: typeof ListTodo; label: string }
interface NavItem { href: string; icon: typeof ListTodo; label: string; showCounter?: boolean; children?: NavChild[] }

const navItems: NavItem[] = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/komunikacja',  icon: MessageSquare,   label: 'Komunikacja', showCounter: true },
  { href: '/zadania',      icon: ListTodo,        label: 'Zadania', children: [
    { href: '/zadania',           icon: ListTodo,     label: 'Kanban' },
    { href: '/zadania/kalendarz', icon: CalendarDays, label: 'Kalendarz' },
  ] },
  { href: '/kontakty',     icon: BookUser,        label: 'Baza kontaktów', children: [
    { href: '/kontakty',                 icon: BookUser,    label: 'Wszystkie' },
    { href: '/kontakty?typ=inwestor',    icon: TrendingUp,  label: 'Inwestorzy' },
    { href: '/kontakty?typ=spoldzielnia',icon: Landmark,    label: 'Spółdzielnie' },
    { href: '/kontakty?typ=wspolnota',   icon: Users2,      label: 'Wspólnoty' },
    { href: '/kontakty?typ=zarzadca',    icon: Briefcase,   label: 'Zarządcy' },
    { href: '/kontakty?typ=komornik',    icon: Gavel,       label: 'Komornicy' },
  ] },
  { href: '/nieruchomosci',icon: Building2,       label: 'Nieruchomości' },
  { href: '/leady',        icon: Inbox,           label: 'Leady' },
  { href: '/mapa',         icon: MapPin,          label: 'Mapa' },
  { href: '/zespol',       icon: Users,           label: 'Zespół' },
]

const adminItems: NavItem[] = [
  { href: '/admin', icon: UserCog, label: 'Użytkownicy' },
]

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentFull = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useWallContext()
  const isAdmin = profile?.role === 'admin'
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({})

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])]

  function isChildActive(child: NavChild) {
    return child.href.includes('?') ? currentFull === child.href : pathname === child.href
  }

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
          const hasChildActive = item.children?.some(isChildActive) ?? false
          const isActive = pathname.startsWith(item.href)
          const counter = 'showCounter' in item && item.showCounter ? unreadCount : 0

          if (item.children) {
            const expanded = manuallyToggled[item.href] ?? hasChildActive
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setManuallyToggled(m => ({ ...m, [item.href]: !expanded }))}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded text-sm uppercase tracking-wider font-medium transition-all duration-200',
                    hasChildActive ? 'text-limona-lime' : 'text-limona-text-muted hover:text-limona-white hover:bg-limona-surface-2'
                  )}>
                  <item.icon size={18} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
                </button>
                {expanded && (
                  <div className="ml-4 pl-3 border-l border-limona-border space-y-1 mb-1">
                    {item.children.map(child => {
                      const childActive = isChildActive(child)
                      return (
                        <Link key={child.href} href={child.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded text-xs uppercase tracking-wider font-medium transition-all duration-200',
                            childActive ? 'bg-limona-lime/10 text-limona-lime border-l-2 border-limona-lime'
                              : 'text-limona-text-muted hover:text-limona-white hover:bg-limona-surface-2'
                          )}>
                          <child.icon size={14} />
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

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
})
