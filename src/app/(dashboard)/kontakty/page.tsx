'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useKontakty } from '@/hooks/useKontakty'
import { useAuth } from '@/hooks/useAuth'
import { KontaktyTable } from '@/components/kontakty/KontaktyTable'
import { KontaktForm } from '@/components/kontakty/KontaktForm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Kontakt, Profile } from '@/types/database'

export default function KontaktyPage() {
  const { user } = useAuth()
  const { kontakty, loading, createKontakt } = useKontakty()
  const { showToast } = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

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
      <div>
        <span className="limona-eyebrow">Partnerzy i dostawcy</span>
        <h1 className="limona-heading text-3xl mt-1">Baza kontaktów</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Spółdzielnie, pośrednicy, kancelarie i inni partnerzy
        </p>
      </div>

      <div className="limona-card p-4 lg:p-6">
        <KontaktyTable
          kontakty={kontakty}
          loading={loading}
          profiles={profiles}
          onAdd={() => setShowAddModal(true)}
        />
      </div>

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
