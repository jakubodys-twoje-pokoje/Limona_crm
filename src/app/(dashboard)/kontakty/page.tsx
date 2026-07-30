'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { List, Map, Share2, ShieldAlert } from 'lucide-react'
import { useKontakty } from '@/hooks/useKontakty'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { canSeeInvestors, canManageTeams } from '@/lib/roles'
import { KontaktyTable } from '@/components/kontakty/KontaktyTable'
import { KontaktForm } from '@/components/kontakty/KontaktForm'
import { ShareCityModal } from '@/components/kontakty/ShareCityModal'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { usePersistentState } from '@/hooks/usePersistentState'
import { cn } from '@/lib/utils'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY } from '@/types/database'
import type { Kontakt, KontaktTyp, Profile } from '@/types/database'

const KontaktyMap = dynamic(() => import('@/components/kontakty/KontaktyMap'), { ssr: false })

type ViewMode = 'lista' | 'mapa'

export default function KontaktyPage() {
  const { user, profile } = useAuth()
  const searchParams = useSearchParams()
  const typParam = searchParams.get('typ')
  const activeTyp: KontaktTyp | null = typParam && (KONTAKT_TYPY as string[]).includes(typParam) ? typParam as KontaktTyp : null
  const denied = activeTyp === 'inwestor' && !canSeeInvestors(profile?.role)
  const { visibleIds, loading: visLoading } = useVisibleUserIds(user?.id, profile?.role)
  const filters = useMemo(() => ({ visibleIds, typ: denied ? undefined : (activeTyp || undefined) }), [visibleIds, activeTyp, denied])
  const { kontakty, loading, createKontakt, fetchKontakty } = useKontakty(filters, !visLoading)
  const { showToast } = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showShareCityModal, setShowShareCityModal] = useState(false)
  const [view, setView] = usePersistentState<ViewMode>('kontakty:view', 'lista')
  const canBulkShare = canManageTeams(profile?.role)

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
          <h1 className="limona-heading text-3xl mt-1">
            {denied ? 'Baza kontaktów' : activeTyp ? KONTAKT_TYP_LABELS[activeTyp] : 'Baza kontaktów'}
          </h1>
          <p className="text-limona-text-muted text-sm mt-1">
            {denied
              ? 'Brak dostępu do tej kategorii'
              : activeTyp
                ? `Kontakty typu: ${KONTAKT_TYP_LABELS[activeTyp]}`
                : canSeeInvestors(profile?.role)
                  ? 'Inwestorzy, spółdzielnie, wspólnoty, zarządcy i komornicy'
                  : 'Spółdzielnie, wspólnoty, zarządcy i komornicy'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
        {canBulkShare && (
          <button
            onClick={() => setShowShareCityModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs uppercase tracking-wider font-medium border border-limona-border text-limona-text-muted hover:border-limona-lime hover:text-limona-lime transition-colors"
            title="Udostępnij wszystkie kontakty z miasta wybranej osobie"
          >
            <Share2 size={13} /> Udostępnij miasto
          </button>
        )}

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
      </div>

      {/* Content */}
      {denied ? (
        <div className="limona-card p-8 flex flex-col items-center text-center gap-3">
          <ShieldAlert size={28} className="text-limona-text-dim" />
          <p className="text-limona-text font-medium">Brak dostępu</p>
          <p className="text-limona-text-muted text-sm max-w-sm">
            Kontakty typu Inwestor są widoczne wyłącznie dla centrali i administratorów.
          </p>
        </div>
      ) : view === 'lista' ? (
        <div className="limona-card p-4 lg:p-6">
          <KontaktyTable
            kontakty={kontakty}
            loading={loading}
            profiles={profiles}
            onAdd={() => setShowAddModal(true)}
            onRefresh={fetchKontakty}
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
        confirmClose
      >
        <KontaktForm
          initial={activeTyp ? { typ: activeTyp } : undefined}
          profiles={profiles}
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          submitLabel="Dodaj"
        />
      </Modal>

      {canBulkShare && (
        <ShareCityModal
          isOpen={showShareCityModal}
          onClose={() => setShowShareCityModal(false)}
          kontakty={kontakty}
          profiles={profiles}
        />
      )}
    </div>
  )
}
