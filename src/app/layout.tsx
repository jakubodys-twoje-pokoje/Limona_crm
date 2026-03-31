import type { Metadata } from 'next'
import { AuthProvider } from '@/hooks/useAuth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Limona CRM — Nieruchomości',
  description: 'CRM do zarządzania nieruchomościami zadłużonymi — Limona sp. z o.o.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-limona-bg">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
