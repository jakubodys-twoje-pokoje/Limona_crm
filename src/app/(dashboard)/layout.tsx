'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'
import { NotificationModal } from '@/components/ui/NotificationModal'
import { WallProvider } from '@/hooks/useWallProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-limona-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <ToastProvider>
      <WallProvider>
        <div className="min-h-screen bg-limona-bg">
          <Sidebar />
          <TopBar />
          <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
            <div className="p-4 lg:p-8">
              {children}
            </div>
          </main>
          <MobileNav />
          <NotificationModal />
        </div>
      </WallProvider>
    </ToastProvider>
  )
}
