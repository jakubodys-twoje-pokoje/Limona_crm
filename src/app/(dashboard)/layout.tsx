'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/Confirm'
import { NotificationModal } from '@/components/ui/NotificationModal'
import { WallProvider } from '@/hooks/useWallProvider'
import { DailyReportCta } from '@/components/reports/DailyReportCta'
import { MissedReportGate } from '@/components/reports/MissedReportGate'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const requiresDailyReport = profile?.role === 'user'

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
      <ConfirmProvider>
      <WallProvider>
        <div className="min-h-screen bg-limona-bg">
          <Sidebar />
          <TopBar />
          {/* CTA raportu dziennego — desktop, prawy górny róg (tylko rola user) */}
          {requiresDailyReport && (
            <div className="hidden lg:block fixed top-4 right-6 z-40">
              <DailyReportCta />
            </div>
          )}
          <main className="lg:ml-64 pt-14 lg:pt-16 pb-20 lg:pb-0 min-h-screen">
            <div className="p-4 lg:p-8 lg:pt-2">
              {children}
            </div>
          </main>
          <MobileNav />
          <NotificationModal />
          {requiresDailyReport && <MissedReportGate />}
        </div>
      </WallProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
