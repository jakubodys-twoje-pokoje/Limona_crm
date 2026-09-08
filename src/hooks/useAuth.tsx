'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Kto naprawdę jest zalogowany, gdy trwa podgląd „jako użytkownik" */
export interface ViewAsState {
  real_id: string
  real_name: string
  real_role: string
}

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
  email: string
  rejon: string | null
  rejon_lat: number | null
  rejon_lng: number | null
  theme_preference: string
  /** Niepuste tylko w trybie podglądu jako inny użytkownik */
  view_as?: ViewAsState | null
}

interface AuthContextType {
  user: { id: string; email: string } | null
  profile: Profile | null
  loading: boolean
  /** Trwa podgląd jako inny użytkownik (tylko odczyt) — dane osoby oglądającej */
  viewAs: ViewAsState | null
  /** Wyjście z podglądu i powrót na własne konto */
  exitViewAs: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  viewAs: null,
  exitViewAs: async () => {},
  signIn: async () => ({ error: null }),
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadUser(sessionUser: { id: string; email?: string } | null) {
      if (!sessionUser) {
        if (!cancelled) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setUser({ id: sessionUser.id, email: sessionUser.email || '' })
      }
      try {
        const res = await fetch('/api/profiles/me')
        if (res.ok && !cancelled) {
          const data: Profile = await res.json()
          setProfile(data)
          // W podglądzie „jako" tożsamością efektywną (także dla UI) jest
          // osoba oglądana — API filtruje dane dokładnie tak samo.
          if (data.view_as) setUser({ id: data.id, email: data.email })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      loadUser(data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED nie zmienia usera — bez ponownego fetchu profilu
      if (event === 'TOKEN_REFRESHED') return
      loadUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Nieprawidłowy email lub hasło' }
    return { error: null }
  }, [supabase])

  const exitViewAs = useCallback(async () => {
    await fetch('/api/impersonate', { method: 'DELETE' })
    // Twardy reload: wszystkie widoki mają się przeładować na własne dane
    window.location.href = '/dashboard'
  }, [])

  const signOut = useCallback(async () => {
    // Wylogowanie kończy też podgląd — inaczej ciasteczko zostałoby na przeglądarce
    await fetch('/api/impersonate', { method: 'DELETE' }).catch(() => {})
    await supabase.auth.signOut()
  }, [supabase])

  const value = useMemo(() => ({
    user, profile, loading, viewAs: profile?.view_as ?? null, exitViewAs, signIn, signOut,
  }), [user, profile, loading, exitViewAs, signIn, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
