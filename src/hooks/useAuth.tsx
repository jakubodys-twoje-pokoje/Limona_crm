'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
  email: string
  rejon: string | null
  rejon_lat: number | null
  rejon_lng: number | null
}

interface AuthContextType {
  user: { id: string; email: string } | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
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
        if (res.ok && !cancelled) setProfile(await res.json())
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const value = useMemo(() => ({
    user, profile, loading, signIn, signOut,
  }), [user, profile, loading, signIn, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
