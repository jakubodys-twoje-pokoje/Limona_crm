'use client'

import { Eye, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types/database'

/**
 * Pasek widoczny przez cały czas podglądu „jako użytkownik" — żeby nikt nie
 * pomylił cudzego widoku z własnym kontem i miał wyjście pod ręką.
 */
export function ViewAsBanner() {
  const { profile, viewAs, exitViewAs } = useAuth()
  if (!viewAs || !profile) return null

  const role = ROLE_LABELS[profile.role as UserRole] ?? profile.role

  // top-14 na mobile: pasek trzyma się tuż pod górnym paskiem (fixed);
  // na desktopie górnego paska nie ma, więc przykleja się do samej góry.
  return (
    <div className="sticky top-14 lg:top-0 z-30 bg-limona-yellow/15 border-b border-limona-yellow/40 backdrop-blur px-4 lg:px-8 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-xs text-limona-yellow uppercase tracking-wider font-bold">
          <Eye size={14} /> Podgląd jako
        </span>
        <span className="text-sm text-limona-white truncate">
          {profile.full_name} <span className="text-limona-text-muted">· {role}</span>
        </span>
        <span className="text-[11px] text-limona-text-muted">tylko do odczytu — zmiany są zablokowane</span>
        <button
          type="button"
          onClick={exitViewAs}
          className="ml-auto flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-yellow hover:text-limona-white transition-colors"
        >
          <LogOut size={13} /> Wróć na swoje konto ({viewAs.real_name})
        </button>
      </div>
    </div>
  )
}
