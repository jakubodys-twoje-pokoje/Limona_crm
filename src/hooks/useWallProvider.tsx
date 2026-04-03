'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useWall } from '@/hooks/useWall'
import { useAuth } from '@/hooks/useAuth'

interface WallContextType {
  unreadCount: number
  messages: ReturnType<typeof useWall>['messages']
  loading: boolean
  postMessage: ReturnType<typeof useWall>['postMessage']
  deleteMessage: ReturnType<typeof useWall>['deleteMessage']
  togglePin: ReturnType<typeof useWall>['togglePin']
  markAsRead: ReturnType<typeof useWall>['markAsRead']
  isRead: ReturnType<typeof useWall>['isRead']
}

const WallContext = createContext<WallContextType>({
  unreadCount: 0,
  messages: [],
  loading: true,
  postMessage: async () => ({ error: null, data: null }),
  deleteMessage: async () => ({ error: null }),
  togglePin: async () => ({ error: null }),
  markAsRead: async () => {},
  isRead: () => false,
})

export function useWallContext() {
  return useContext(WallContext)
}

export function WallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const wall = useWall(user?.id)

  const value = useMemo(() => ({
    unreadCount: wall.unreadCount,
    messages: wall.messages,
    loading: wall.loading,
    postMessage: wall.postMessage,
    deleteMessage: wall.deleteMessage,
    togglePin: wall.togglePin,
    markAsRead: wall.markAsRead,
    isRead: wall.isRead,
  }), [wall.unreadCount, wall.messages, wall.loading, wall.postMessage, wall.deleteMessage, wall.togglePin, wall.markAsRead, wall.isRead])

  return (
    <WallContext.Provider value={value}>
      {children}
    </WallContext.Provider>
  )
}
