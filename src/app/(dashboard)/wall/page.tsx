'use client'

export const dynamic = 'force-dynamic'

import { WallContent } from '@/components/wall/WallContent'

export default function WallPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <span className="limona-eyebrow">Komunikacja</span>
        <h1 className="limona-heading text-3xl mt-1">Wall</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Kanał zespołowy — wiadomości trzymane 90 dni •{' '}
          <span className="text-limona-lime">@imię</span> aby oznaczyć •{' '}
          <span className="text-limona-blue">#&quot;nazwa zadania&quot;</span> aby odnieść się do zadania
        </p>
      </div>
      <WallContent />
    </div>
  )
}
