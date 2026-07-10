'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Shield, Trash2, Edit, X, UserPlus, Database, Users, UsersRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamVisibility } from '@/hooks/useTeamVisibility'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { canManageTeams, ROLE_LABELS } from '@/lib/roles'
import type { Profile, UserRole } from '@/types/database'

export default function AdminPage() {
  const { profile: myProfile } = useAuth()
  const { showToast } = useToast()
  const isAdmin = myProfile?.role === 'admin'

  const { rules, profiles, loading, addRule, removeRule, refetch } = useTeamVisibility()
  const canManageGroups = canManageTeams(myProfile?.role)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', role: 'user' as UserRole, avatar_url: '', rejon: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  // Group assignment
  const [assigningUser, setAssigningUser] = useState<Profile | null>(null)
  const [assignManagerId, setAssignManagerId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Create user form
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: 'user' as UserRole, rejon: '' })
  const [creating, setCreating] = useState(false)

  // DB cleanup
  const [cleanupPreview, setCleanupPreview] = useState<{ directMessages: number; groupMessages: number; wallMessages: number; readNotifications: number } | null>(null)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  async function fetchCleanupPreview() {
    const res = await fetch('/api/cleanup')
    if (res.ok) {
      const data = await res.json()
      setCleanupPreview(data.toDelete)
    }
  }

  async function runCleanup() {
    if (!window.confirm('Usunąć stare wiadomości (>90 dni) i przeczytane powiadomienia (>30 dni)?')) return
    setCleanupRunning(true)
    const res = await fetch('/api/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'all' }) })
    if (res.ok) {
      const data = await res.json()
      const total = Object.values(data.deleted as Record<string, number>).reduce((a, b) => a + b, 0)
      setCleanupResult(`Usunięto ${total} rekordów (DM: ${data.deleted.directMessages ?? 0}, Grupy: ${data.deleted.groupMessages ?? 0}, Wall: ${data.deleted.wallMessages ?? 0}, Powiadomienia: ${data.deleted.notifications ?? 0})`)
      setCleanupPreview(null)
    }
    setCleanupRunning(false)
  }

  const [missedCounts, setMissedCounts] = useState<Record<string, number>>({})

  // Ewaluacja: potwierdzone braki raportu dziennego w bieżącym miesiącu
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/reports/missed/count')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMissedCounts(d.counts || {}) })
  }, [isAdmin])

  function startEdit(p: Profile) {
    setEditingUser(p)
    setEditForm({ full_name: p.full_name, role: p.role, avatar_url: p.avatar_url || '', rejon: p.rejon || '' })
  }

  async function handleSave() {
    if (!editingUser) return
    setSaving(true)
    const res = await fetch(`/api/profiles/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editForm.full_name, role: editForm.role, avatar_url: editForm.avatar_url || null, rejon: editForm.rejon }),
    })

    if (!res.ok) showToast((await res.json()).error || 'Błąd', 'error')
    else { showToast('Profil zaktualizowany', 'success'); setEditingUser(null); refetch() }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const res = await fetch(`/api/profiles/${deleteConfirm.id}`, { method: 'DELETE' })
    if (!res.ok) showToast((await res.json()).error || 'Błąd', 'error')
    else { showToast('Użytkownik usunięty', 'success'); refetch() }
    setDeleteConfirm(null)
  }

  function openAssign(p: Profile) {
    setAssigningUser(p)
    setAssignManagerId('')
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assigningUser || !assignManagerId) return
    setAssigning(true)
    const { error } = await addRule(assignManagerId, assigningUser.id, myProfile?.id || '')
    if (error) showToast(error, 'error')
    else { showToast('Użytkownik przypisany do zespołu', 'success'); setAssigningUser(null) }
    setAssigning(false)
  }

  async function handleRemoveFromGroup(ruleId: string) {
    const { error } = await removeRule(ruleId)
    if (error) showToast(error, 'error')
    else showToast('Usunięto z zespołu', 'success')
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    if (!res.ok) showToast((await res.json()).error || 'Błąd', 'error')
    else {
      showToast('Użytkownik utworzony', 'success')
      setShowCreateModal(false)
      setCreateForm({ email: '', password: '', fullName: '', role: 'user', rejon: '' })
      refetch()
    }
    setCreating(false)
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
      <div className="flex items-center justify-between">
        <div>
          <span className="limona-eyebrow">Administracja</span>
          <h1 className="limona-heading text-3xl mt-1">Zarządzanie użytkownikami</h1>
          <p className="text-limona-text-muted text-sm mt-1">Edytuj profile, role i avatary użytkowników</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="limona-btn flex items-center gap-2">
          <UserPlus size={16} />
          Dodaj użytkownika
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => {
            const managedRules = rules.filter(r => r.manager_id === p.id)
            const memberRules = rules.filter(r => r.member_id === p.id)
            return (
              <div key={p.id} className="limona-card p-4 group">
                <div className="flex items-center gap-4">
                  <Avatar name={p.full_name} url={p.avatar_url} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-limona-white">{p.full_name}</p>
                    <p className="text-xs text-limona-text-dim mt-0.5 truncate">{p.id}</p>
                  </div>
                  {(missedCounts[p.id] ?? 0) > 0 && (
                    <span
                      className="limona-badge text-[10px] bg-limona-red/15 text-limona-red whitespace-nowrap"
                      title="Potwierdzone braki raportu dziennego w tym miesiącu"
                    >
                      {missedCounts[p.id]} {missedCounts[p.id] === 1 ? 'brak raportu' : 'braki raportów'}
                    </span>
                  )}
                  <span className={cn(
                    'limona-badge text-[10px]',
                    p.role === 'admin' ? 'bg-limona-lime/20 text-limona-lime' : 'bg-limona-border text-limona-text-muted'
                  )}>
                    {ROLE_LABELS[p.role] ?? p.role}
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

                {canManageGroups && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pl-[calc(3rem+1rem)]">
                    {managedRules.length > 0 && (
                      <span className="limona-badge text-[10px] bg-limona-yellow/15 text-limona-yellow flex items-center gap-1">
                        <UsersRound size={11} />
                        Kierownik zespołu ({managedRules.length})
                      </span>
                    )}
                    {memberRules.map(rule => (
                      <span key={rule.id} className="limona-badge text-[10px] bg-limona-surface-2 text-limona-text-muted flex items-center gap-1.5">
                        Zespół: {rule.manager?.full_name || rule.manager_id.slice(0, 8)}
                        <button
                          onClick={() => handleRemoveFromGroup(rule.id)}
                          className="hover:text-limona-red transition-colors"
                          title="Usuń z zespołu"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => openAssign(p)}
                      className="text-[10px] text-limona-text-dim hover:text-limona-lime uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                      <Users size={11} /> Przypisz do zespołu
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* DB Cleanup */}
      <div className="limona-card p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} className="text-limona-text-muted" />
          <h2 className="limona-heading text-lg">Zarządzanie danymi</h2>
        </div>
        <div className="space-y-3 text-sm text-limona-text-muted mb-4">
          <p>Polityka retencji wiadomości:</p>
          <ul className="ml-4 space-y-1 text-xs">
            <li>• <span className="text-limona-white">Chat (DM i Grupy)</span> — domyślnie wyświetlane ostatnie <strong>30 dni</strong>, archiwum dostępne w widoku 30–90 dni</li>
            <li>• Po <span className="text-limona-red">90 dniach</span> — trwałe usunięcie wiadomości (czat, grupy, wall nieprzypięte)</li>
            <li>• <span className="text-limona-yellow">Powiadomienia przeczytane</span> — trwałe usunięcie po 30 dniach</li>
          </ul>
        </div>
        {cleanupResult && (
          <div className="bg-limona-green/10 border border-limona-green/30 rounded p-3 text-sm text-limona-green mb-4">
            {cleanupResult}
          </div>
        )}
        {cleanupPreview ? (
          <div className="bg-limona-surface-2 rounded p-4 mb-4 space-y-2">
            <p className="text-xs text-limona-text-muted font-bold uppercase tracking-wider mb-2">Do usunięcia (starsze niż 90 dni):</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span>DM: <strong className="text-limona-white">{cleanupPreview.directMessages}</strong></span>
              <span>Grupy: <strong className="text-limona-white">{cleanupPreview.groupMessages}</strong></span>
              <span>Wall: <strong className="text-limona-white">{cleanupPreview.wallMessages}</strong></span>
              <span>Powiadomienia: <strong className="text-limona-white">{cleanupPreview.readNotifications}</strong></span>
            </div>
          </div>
        ) : null}
        <div className="flex gap-3">
          <button onClick={fetchCleanupPreview} className="limona-btn-outline text-xs">
            Podgląd do usunięcia
          </button>
          <button
            onClick={runCleanup}
            disabled={cleanupRunning}
            className="text-xs bg-limona-red/10 border border-limona-red/40 text-limona-red hover:bg-limona-red/20 rounded-full px-4 py-2 font-medium uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            {cleanupRunning ? 'Czyszczenie...' : 'Wyczyść stare dane'}
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Dodaj użytkownika" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Imię i nazwisko *</label>
            <input className="limona-input" value={createForm.fullName} onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))} required autoFocus />
          </div>
          <div>
            <label className="limona-label block mb-2">Email *</label>
            <input type="email" className="limona-input" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="limona-label block mb-2">Hasło *</label>
            <input type="password" className="limona-input" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required minLength={6} placeholder="Minimum 6 znaków" />
          </div>
          <div>
            <label className="limona-label block mb-2">Rola</label>
            <select className="limona-select" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="kierownik_centrali">Kierownik centrali</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Rejon (miasto)</label>
            <input className="limona-input" value={createForm.rejon} onChange={e => setCreateForm(f => ({ ...f, rejon: e.target.value }))} placeholder="np. Kraków" />
            <p className="text-xs text-limona-text-dim mt-1">Domyślne miasto przy dodawaniu nieruchomości i środek mapy dla tego użytkownika.</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={creating} className="limona-btn disabled:opacity-50">
              {creating ? 'Tworzenie...' : 'Utwórz'}
            </button>
          </div>
        </form>
      </Modal>

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
              <option value="admin">Admin — pełny dostęp + panel admina</option>
              <option value="kierownik_centrali">Kierownik centrali — ewaluacja wszystkich zespołów, bez zarządzania kontami</option>
              <option value="manager">Manager — widzi wszystko, zarządza leadami</option>
              <option value="user">User — widzi swoje + przypisane</option>
              <option value="viewer">Viewer — tylko odczyt</option>
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Avatar URL</label>
            <input className="limona-input" value={editForm.avatar_url} onChange={e => setEditForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://... lub pozostaw puste dla inicjałów" />
          </div>
          <div>
            <label className="limona-label block mb-2">Rejon (miasto)</label>
            <input className="limona-input" value={editForm.rejon} onChange={e => setEditForm(f => ({ ...f, rejon: e.target.value }))} placeholder="np. Kraków" />
            <p className="text-xs text-limona-text-dim mt-1">Domyślne miasto przy dodawaniu nieruchomości i środek mapy dla tego użytkownika.</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setEditingUser(null)} className="limona-btn-outline">Anuluj</button>
            <button onClick={handleSave} disabled={saving} className="limona-btn disabled:opacity-50">
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign to group */}
      <Modal isOpen={!!assigningUser} onClose={() => setAssigningUser(null)} title={`Przypisz do zespołu: ${assigningUser?.full_name}`} size="sm">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Kierownik zespołu</label>
            <select className="limona-select" value={assignManagerId} onChange={e => setAssignManagerId(e.target.value)} required autoFocus>
              <option value="">Wybierz kierownika...</option>
              {profiles.filter(p => p.id !== assigningUser?.id).map(p => (
                <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role] ?? p.role})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setAssigningUser(null)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={assigning || !assignManagerId} className="limona-btn disabled:opacity-50">
              {assigning ? 'Przypisywanie...' : 'Przypisz'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Potwierdź usunięcie" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-limona-text">
              Czy na pewno usunąć <span className="text-limona-white font-medium">{deleteConfirm.full_name}</span>?
            </p>
            <p className="text-xs text-limona-red">Uwaga: Usunięcie jest nieodwracalne i usunie wszystkie dane użytkownika.</p>
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
