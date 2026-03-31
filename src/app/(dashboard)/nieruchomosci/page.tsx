'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useProperties } from '@/hooks/useProperties'
import { useAuth } from '@/hooks/useAuth'
import { PropertiesTable } from '@/components/properties/PropertiesTable'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Property } from '@/types/database'

export default function NieruchomosciPage() {
  const { properties, loading, createProperty, updateProperty, deleteProperty } = useProperties()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Property | null>(null)

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
    const { error } = await deleteProperty(deleteConfirm.id)
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

      {/* Table */}
      <div className="limona-card p-4 lg:p-6">
        <PropertiesTable
          properties={properties}
          loading={loading}
          onAdd={() => setShowAddModal(true)}
          onEdit={setEditProperty}
          onDelete={setDeleteConfirm}
        />
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Dodaj nieruchomość"
        size="xl"
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
              <span className="text-limona-white font-medium">{deleteConfirm.location}</span>?
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
