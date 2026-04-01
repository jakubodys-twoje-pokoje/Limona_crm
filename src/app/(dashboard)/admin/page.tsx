'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Trash2, Edit, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { Profile, UserRole } from '@/types/database'

export default function AdminPage() {
  const { profile: myProfile } = useAuth()
  const { showToast } = useToast()
  const isAdmin = myProfile?.role === 'admin'

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', role: 'user' as UserRole, avatar_url: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((data as Profile[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  function startEdit(p: Profile) {
    setEditingUser(p)
    setEditForm({ full_name: p.full_name, role: p.role, avatar_url: p.avatar_url || '' })
  }

  async function handleSave() {
    if (!editingUser) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editForm.full_name, role: editForm.role, avatar_url: editForm.avatar_url || null })
      .eq('id', editingUser.id)

    if (error) showToast(error.message, 'error')
    else { showToast('Profil zaktualizowany', 'success'); setEditingUser(null); fetchProfiles() }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const { error } = await supabase.from('profiles').delete().eq('id', deleteConfirm.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Użytkownik usunięty', 'success'); fetchProfiles() }
    setDeleteConfirm(null)
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <Shield size={48} className="text-limona-red mx-auto mb-4" />
        <h1 className="limona-heading text-2xl mb-2">Brak dostępu</h1>
        <p className="text-limona-text-muted">Ta strona jest dostępna tylko dla administratorów.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <span className="limona-eyebrow">Administracja</span>
        <h1 className="limona-heading text-3xl mt-1">Zarządzanie użytkownikami</h1>
        <p className="text-limona-text-muted text-sm mt-1">Edytuj profile, role i avatary użytkowników</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="limona-card p-4 flex items-center gap-4 group">
              <Avatar name={p.full_name} url={p.avatar_url} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-limona-white">{p.full_name}</p>
                <p className="text-xs text-limona-text-dim mt-0.5 truncate">{p.id}</p>
              </div>
              <span className={cn(
                'limona-badge text-[10px]',
                p.role === 'admin' ? 'bg-limona-lime/20 text-limona-lime' : 'bg-limona-border text-limona-text-muted'
              )}>
                {p.role}
              </span>
              <div className="flex gap-1">
                <button onClick={() => startEdit(p)} className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors" title="Edytuj">
                  <Edit size={16} />
                </button>
                {p.id !== myProfile?.id && (
                  <button onClick={() => setDeleteConfirm(p)} className="p-2 text-limona-text-muted hover:text-limona-red transition-colors" title="Usuń">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title={`Edytuj: ${editingUser?.full_name}`} size="md">
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={editForm.full_name || 'User'} url={editForm.avatar_url || null} size="lg" />
            <p className="text-xs text-limona-text-muted">Podgląd avatara</p>
          </div>
          <div>
            <label className="limona-label block mb-2">Imię i nazwisko</label>
            <input className="limona-input" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="limona-label block mb-2">Rola</label>
            <select className="limona-select" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Avatar URL</label>
            <input className="limona-input" value={editForm.avatar_url} onChange={e => setEditForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://... lub pozostaw puste dla inicjałów" />
            <p className="text-xs text-limona-text-dim mt-1">Wklej URL do zdjęcia lub zostaw puste — wyświetlą się inicjały</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setEditingUser(null)} className="limona-btn-outline">Anuluj</button>
            <button onClick={handleSave} disabled={saving} className="limona-btn disabled:opacity-50">
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Potwierdź usunięcie" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-limona-text">
              Czy na pewno usunąć <span className="text-limona-white font-medium">{deleteConfirm.full_name}</span>?
            </p>
            <p className="text-xs text-limona-red">Uwaga: Usunięcie profilu nie usuwa konta z Supabase Auth. Aby w pełni usunąć konto, zrób to z poziomu Supabase Dashboard.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="limona-btn-outline">Anuluj</button>
              <button onClick={handleDelete} className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-6 py-3 text-sm hover:opacity-90">Usuń</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
