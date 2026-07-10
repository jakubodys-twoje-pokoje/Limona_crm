'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { List, Map } from 'lucide-react'
import { useKontakty } from '@/hooks/useKontakty'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { KontaktyTable } from '@/components/kontakty/KontaktyTable'
import { KontaktForm } from '@/components/kontakty/KontaktForm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { Kontakt, Profile } from '@/types/database'

const KontaktyMap = dynamic(() => import('@/components/kontakty/KontaktyMap'), { ssr: false })

type ViewMode = 'lista' | 'mapa'

export default function KontaktyPage() {
  const { user, profile } = useAuth()
  const { visibleIds } = useVisibleUserIds(user?.id, profile?.role)
  const filters = useMemo(() => ({ visibleIds }), [visibleIds])
  const { kontakty, loading, createKontakt } = useKontakty(filters)
  const { showToast } = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [view, setView] = useState<ViewMode>('lista')

  useEffect(() => {
    fetch('/api/profiles').then(r => r.ok ? r.json() : []).then(setProfiles)
  }, [])

  async function handleAdd(data: Partial<Kontakt>) {
    const { error } = await createKontakt(data)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Kontakt dodany', 'success')
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="limona-eyebrow">Partnerzy i dostawcy</span>
          <h1 className="limona-heading text-3xl mt-1">Baza kontaktów</h1>
          <p className="text-limona-text-muted text-sm mt-1">
            Spółdzielnie, pośrednicy, kancelarie i inni partnerzy
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-limona-bg rounded border border-limona-border">
          {([
            ['lista', List,  'Lista'],
            ['mapa',  Map,   'Mapa'],
          ] as [ViewMode, React.ElementType, string][]).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium transition-colors',
                view === mode
                  ? 'bg-limona-lime text-black'
                  : 'text-limona-text-muted hover:text-limona-white'
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === 'lista' ? (
        <div className="limona-card p-4 lg:p-6">
          <KontaktyTable
            kontakty={kontakty}
            loading={loading}
            profiles={profiles}
            onAdd={() => setShowAddModal(true)}
          />
        </div>
      ) : (
        /* Full-bleed map — escapes the p-4 lg:p-8 dashboard padding */
        <div className="-mx-4 lg:-mx-8 -mb-4 lg:-mb-8">
          <KontaktyMap
            kontakty={kontakty}
            height="calc(100vh - 220px)"
            defaultCenter={profile?.rejon_lat && profile?.rejon_lng ? { lat: profile.rejon_lat, lng: profile.rejon_lng } : null}
          />
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Dodaj kontakt"
        size="xl"
      >
        <KontaktForm
          profiles={profiles}
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          submitLabel="Dodaj"
        />
      </Modal>
    </div>
  )
}
