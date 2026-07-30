'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { PropertiesTable } from '@/components/properties/PropertiesTable'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn, formatPropertyAddress } from '@/lib/utils'
import { ARCHIVE_RETENTION_DAYS } from '@/lib/stages'
import type { Property } from '@/types/database'

// Ile pełnych dni zostało do trwałego usunięcia z archiwum
function daysLeftInArchive(archivedAt: string | null): number {
  if (!archivedAt) return ARCHIVE_RETENTION_DAYS
  const elapsedMs = Date.now() - new Date(archivedAt).getTime()
  const left = ARCHIVE_RETENTION_DAYS - Math.floor(elapsedMs / (24 * 3600 * 1000))
  return Math.max(0, left)
}

export default function NieruchomosciPage() {
  const { user, profile } = useAuth()
  const { visibleIds, loading: visLoading } = useVisibleUserIds(user?.id, profile?.role)
  const { properties, loading, createProperty, updateProperty, deleteProperty } = useProperties(visibleIds, !visLoading)
  const { showToast } = useToast()

  const [view, setView] = usePersistentState<'active' | 'archive'>('nieruchomosci:view', 'active')
  const {
    properties: archivedProperties,
    loading: archiveLoading,
    updateProperty: updateArchived,
    deleteProperty: deleteArchived,
  } = useProperties(visibleIds, !visLoading && view === 'archive', true)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Property | null>(null)

  async function handleRestore(p: Property) {
    // Przywrócenie = wyjście ze statusu „zrezygnował"; zmiana statusu wymaga komentarza
    const { error } = await updateArchived(p.id, {
      status_dluznika: 'brak',
      // @ts-expect-error statusComment jest zdejmowany po stronie serwera, nie należy do Property
      statusComment: 'Przywrócono z archiwum',
    }, user?.id ?? '')
    if (error) { showToast(error, 'error'); return }
    showToast('Przywrócono z archiwum', 'success')
  }

  async function handleAdd(data: Partial<Property>) {
    if (!user) return
    const { error } = await createProperty(data, user.id)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Nieruchomość dodana', 'success')
      setShowAddModal(false)
    }
  }

  async function handleEdit(data: Partial<Property>) {
    if (!editProperty || !user) return
    const { error } = await updateProperty(editProperty.id, data, user.id)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Zaktualizowano', 'success')
      setEditProperty(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const del = view === 'archive' ? deleteArchived : deleteProperty
    const { error } = await del(deleteConfirm.id)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Usunięto nieruchomość', 'success')
    }
    setDeleteConfirm(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Pipeline</span>
        <h1 className="limona-heading text-3xl mt-1">Nieruchomości</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Zarządzaj nieruchomościami w pipeline
        </p>
      </div>

      {/* Zakładki: aktywne / archiwum */}
      <div className="flex items-center gap-1 border-b border-limona-border">
        <button
          onClick={() => setView('active')}
          className={cn(
            'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors',
            view === 'active' ? 'border-limona-lime text-limona-lime' : 'border-transparent text-limona-text-muted hover:text-limona-white'
          )}
        >
          Aktywne
        </button>
        <button
          onClick={() => setView('archive')}
          className={cn(
            'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            view === 'archive' ? 'border-limona-lime text-limona-lime' : 'border-transparent text-limona-text-muted hover:text-limona-white'
          )}
        >
          <Archive size={13} /> Archiwum{archivedProperties.length > 0 && ` (${archivedProperties.length})`}
        </button>
      </div>

      {view === 'active' ? (
        /* Table */
        <div className="limona-card p-4 lg:p-6">
          <PropertiesTable
            properties={properties}
            loading={loading}
            onAdd={() => setShowAddModal(true)}
            onEdit={setEditProperty}
            onDelete={setDeleteConfirm}
          />
        </div>
      ) : (
        <div className="limona-card p-4 lg:p-6 space-y-3">
          <p className="text-xs text-limona-text-muted">
            Nieruchomości ze statusem „Zrezygnował”. Trzymane maksymalnie {ARCHIVE_RETENTION_DAYS} dni, potem usuwane automatycznie.
          </p>
          {archiveLoading ? (
            <p className="text-center text-limona-text-muted py-8">Ładowanie…</p>
          ) : archivedProperties.length === 0 ? (
            <p className="text-center text-limona-text-muted py-8">Archiwum jest puste</p>
          ) : (
            <div className="space-y-2">
              {archivedProperties.map(p => {
                const left = daysLeftInArchive(p.archived_at)
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded bg-limona-surface-2/40 hover:bg-limona-surface-2 transition-colors">
                    <div className="flex-1 min-w-0">
                      <Link href={`/nieruchomosci/${p.id}`} className="text-sm text-limona-text hover:text-limona-lime transition-colors truncate block">
                        {formatPropertyAddress(p)}
                      </Link>
                      <p className={cn('text-xs mt-0.5', left <= 5 ? 'text-limona-red' : 'text-limona-text-dim')}>
                        Zarchiwizowano {p.archived_at ? new Date(p.archived_at).toLocaleDateString('pl-PL') : '—'}
                        {' · '}usunięcie za {left} {left === 1 ? 'dzień' : 'dni'}
                      </p>
                    </div>
                    <button onClick={() => handleRestore(p)}
                      className="flex items-center gap-1 text-xs text-limona-text-muted hover:text-limona-lime transition-colors whitespace-nowrap">
                      <RotateCcw size={13} /> Przywróć
                    </button>
                    <button onClick={() => setDeleteConfirm(p)}
                      className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0" title="Usuń teraz">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Dodaj nieruchomość"
        size="xl"
        confirmClose
      >
        <PropertyForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          submitLabel="Dodaj"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editProperty}
        onClose={() => setEditProperty(null)}
        title="Edytuj nieruchomość"
        size="xl"
        confirmClose
      >
        {editProperty && (
          <PropertyForm
            initial={editProperty}
            onSubmit={handleEdit}
            onCancel={() => setEditProperty(null)}
            submitLabel="Zapisz zmiany"
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Potwierdź usunięcie"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-limona-text">
              Czy na pewno usunąć{' '}
              <span className="text-limona-white font-medium">{formatPropertyAddress(deleteConfirm)}</span>?
              Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="limona-btn-outline">
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-6 py-3 text-sm hover:opacity-90 transition-opacity"
              >
                Usuń
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
