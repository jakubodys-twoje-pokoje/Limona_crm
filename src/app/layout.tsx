import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Limona CRM — Nieruchomości',
  description: 'CRM do zarządzania nieruchomościami zadłużonymi — Limona sp. z o.o.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <head>
        {/* Motyw z localStorage stosowany przed pierwszym malowaniem — bez tego byłby błysk złego motywu */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('limona-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        {/* Wysokość widocznego obszaru → --app-height. Dzięki temu dolny pasek
            na iOS nie „ucieka" w górę przy chowaniu paska adresu / klawiaturze
            (VisualViewport jest dokładny tam, gdzie dvh bywa błędne). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function s(){var v=window.visualViewport;var h=v?v.height:window.innerHeight;document.documentElement.style.setProperty('--app-height',h+'px')}s();if(window.visualViewport){window.visualViewport.addEventListener('resize',s);window.visualViewport.addEventListener('scroll',s)}window.addEventListener('resize',s);window.addEventListener('orientationchange',s)})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-limona-bg">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
