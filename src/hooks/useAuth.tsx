'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
  email: string
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
  const { data: session, status } = useSession()
  const loading = status === 'loading'

  const user = useMemo(() => {
    if (!session?.user) return null
    return { id: session.user.id, email: session.user.email || '' }
  }, [session])

  const profile = useMemo((): Profile | null => {
    if (!session?.user) return null
    return {
      id: session.user.id,
      full_name: session.user.name || '',
      avatar_url: session.user.avatar_url,
      role: session.user.role,
      email: session.user.email || '',
    }
  }, [session])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (result?.error) return { error: 'Nieprawidłowy email lub hasło' }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ redirect: false })
  }, [])

  const value = useMemo(() => ({
    user, profile, loading, signIn, signOut,
  }), [user, profile, loading, signIn, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
