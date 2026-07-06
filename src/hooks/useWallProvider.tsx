'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useWall } from '@/hooks/useWall'
import { useAuth } from '@/hooks/useAuth'

interface WallContextType {
  unreadCount: number
}

const WallContext = createContext<WallContextType>({ unreadCount: 0 })

export function useWallContext() {
  return useContext(WallContext)
}

export function WallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { unreadCount } = useWall(user?.id)

  const value = useMemo(() => ({ unreadCount }), [unreadCount])

  return (
    <WallContext.Provider value={value}>
      {children}
    </WallContext.Provider>
  )
}
