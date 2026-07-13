'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const THEME_STORAGE_KEY = 'limona-theme'

export function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* ignore */ }
}

/**
 * Motyw stosowany jest natychmiast z localStorage (patrz inline script w
 * layout.tsx, zapobiega miganiu złego motywu), a po zalogowaniu synchronizuje
 * się z zapisaną preferencją profilu (per użytkownik).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()

  useEffect(() => {
    if (profile?.theme_preference) applyTheme(profile.theme_preference)
  }, [profile?.theme_preference])

  return <>{children}</>
}
