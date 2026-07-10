'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Users, Plus, Trash2, Shield, Star, StarOff, UserX, Pencil, Check, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeams } from '@/hooks/useTeams'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { canManageTeams, ROLE_LABELS } from '@/lib/roles'
import type { UserRole, Team } from '@/types/database'

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  admin: 'bg-limona-lime/20 text-limona-lime',
  kierownik_centrali: 'bg-limona-blue/20 text-limona-blue',
  manager: 'bg-limona-yellow/20 text-limona-yellow',
  user: 'bg-limona-border text-limona-text-muted',
  viewer: 'bg-limona-border text-limona-text-dim',
}

function roleBadge(role: string) {
  const key = (role as UserRole) in ROLE_LABELS ? (role as UserRole) : 'user'
  return { label: ROLE_LABELS[key], style: ROLE_BADGE_STYLE[key] }
}

export default function ZespolPage() {
  const { profile } = useAuth()
  const { teams, profiles, loading, createTeam, updateTeam, deleteTeam, addMembers, setMemberLead, removeMember } = useTeams()
  const { showToast } = useToast()
  const canManage = canManageTeams(profile?.role)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newMemberIds, setNewMemberIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const [addingToTeam, setAddingToTeam] = useState<Team | null>(null)
  const [pickedMemberIds, setPickedMemberIds] = useState<string[]>([])
  const [addingMembers, setAddingMembers] = useState(false)

  const [renamingTeam, setRenamingTeam] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState<Team | null>(null)

  const memberOfAnyTeam = new Set(teams.flatMap(t => (t.members ?? []).map(m => m.user_id)))
  const unassigned = profiles.filter(p => !memberOfAnyTeam.has(p.id))

  function toggleNewMember(id: string) {
    setNewMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const { error } = await createTeam(newName.trim(), newDescription.trim() || null, newMemberIds, newMemberIds.slice(0, 1))
    if (error) showToast(error, 'error')
    else {
      showToast('Zespół utworzony', 'success')
      setShowCreate(false)
      setNewName(''); setNewDescription(''); setNewMemberIds([])
    }
    setCreating(false)
  }

  function openAddMembers(team: Team) {
    setAddingToTeam(team)
    setPickedMemberIds([])
  }

  function togglePicked(id: string) {
    setPickedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAddMembers(e: React.FormEvent) {
    e.preventDefault()
    if (!addingToTeam || pickedMemberIds.length === 0) return
    setAddingMembers(true)
    const { error } = await addMembers(addingToTeam.id, pickedMemberIds)
    if (error) showToast(error, 'error')
    else { showToast('Dodano do zespołu', 'success'); setAddingToTeam(null) }
    setAddingMembers(false)
  }

  async function handleToggleLead(teamId: string, userId: string, isLead: boolean) {
    const { error } = await setMemberLead(teamId, userId, !isLead)
    if (error) showToast(error, 'error')
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    const { error } = await removeMember(teamId, userId)
    if (error) showToast(error, 'error')
    else showToast('Usunięto z zespołu', 'success')
  }

  function startRename(team: Team) {
    setRenamingTeam(team.id)
    setRenameValue(team.name)
  }

  async function saveRename(teamId: string) {
    if (!renameValue.trim()) { setRenamingTeam(null); return }
    const { error } = await updateTeam(teamId, { name: renameValue.trim() })
    if (error) showToast(error, 'error')
    setRenamingTeam(null)
  }

  async function handleDeleteTeam() {
    if (!deleteConfirm) return
    const { error } = await deleteTeam(deleteConfirm.id)
    if (error) showToast(error, 'error')
    else showToast('Zespół usunięty', 'success')
    setDeleteConfirm(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="limona-eyebrow">Administracja</span>
          <h1 className="limona-heading text-3xl mt-1">Zespół</h1>
          <p className="text-limona-text-muted text-sm mt-1">
            Nazwane zespoły, liderzy i widoczność raportów/zadań
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="limona-btn flex items-center gap-2 flex-shrink-0">
            <Plus size={14} /> Nowy zespół
          </button>
        )}
      </div>

      {!canManage && (
        <div className="limona-card p-6 text-center border-l-[3px] border-l-limona-red">
          <Shield size={32} className="text-limona-red mx-auto mb-3" />
          <p className="text-limona-text">Tylko administrator lub kierownik centrali może zarządzać zespołem.</p>
          <p className="text-limona-text-muted text-sm mt-1">
            Twoja rola: <span className="text-limona-white">{roleBadge(profile?.role || 'user').label}</span>
          </p>
        </div>
      )}

      {canManage && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold text-limona-white">{profiles.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-limona-text-muted mt-1">Użytkowników</p>
            </div>
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold text-limona-yellow">{teams.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-limona-text-muted mt-1">Zespołów</p>
            </div>
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold text-limona-red">{unassigned.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-limona-text-muted mt-1">Nieprzypisanych</p>
            </div>
          </div>

          {/* Info */}
          <div className="limona-card-accent p-4">
            <h3 className="text-sm font-medium text-limona-white mb-2">Jak działa widoczność zadań?</h3>
            <ul className="text-xs text-limona-text-muted space-y-1">
              <li><span className="text-limona-lime">Admin</span> i <span className="text-limona-blue">Kierownik centrali</span> — widzą zadania wszystkich (ewaluacja org-wide)</li>
              <li><span className="text-limona-yellow">Lider zespołu</span> (gwiazdka przy członku) — widzi swoje + zadania współczłonków tego zespołu</li>
              <li>Pozostali członkowie — widzą tylko swoje zadania</li>
            </ul>
          </div>

          {/* Teams */}
          {loading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : teams.length === 0 ? (
            <div className="limona-card p-8 text-center">
              <p className="text-limona-text-muted text-sm">Brak zespołów — utwórz pierwszy powyżej</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="limona-card p-4 border-l-[3px] border-l-limona-yellow">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {renamingTeam === team.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          autoFocus
                          className="limona-input text-sm py-1 flex-1"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(team.id); if (e.key === 'Escape') setRenamingTeam(null) }}
                        />
                        <button onClick={() => saveRename(team.id)} className="p-1 text-limona-green hover:opacity-80"><Check size={14} /></button>
                        <button onClick={() => setRenamingTeam(null)} className="p-1 text-limona-text-dim hover:text-limona-red"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0 group">
                        <Users size={14} className="text-limona-yellow flex-shrink-0" />
                        <span className="text-sm font-bold text-limona-white truncate">{team.name}</span>
                        <button onClick={() => startRename(team)} className="p-0.5 text-limona-text-dim opacity-0 group-hover:opacity-100 hover:text-limona-lime transition-all">
                          <Pencil size={11} />
                        </button>
                        <span className="text-[10px] text-limona-text-dim uppercase tracking-wider flex-shrink-0">
                          {(team.members?.length ?? 0)} {team.members?.length === 1 ? 'osoba' : 'osób'}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(team)}
                      className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0"
                      title="Usuń zespół"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {team.description && <p className="text-xs text-limona-text-muted mb-3 pl-6">{team.description}</p>}

                  <div className="space-y-1 pl-6">
                    {(team.members ?? []).length === 0 ? (
                      <p className="text-xs text-limona-text-dim">Brak członków</p>
                    ) : team.members!.map(m => (
                      <div key={m.id} className="flex items-center gap-2 group">
                        {m.profile && <Avatar name={m.profile.full_name} url={m.profile.avatar_url} size="sm" />}
                        <span className="text-sm text-limona-text flex-1">{m.profile?.full_name || m.user_id.slice(0, 8)}</span>
                        <button
                          onClick={() => handleToggleLead(team.id, m.user_id, m.is_lead)}
                          title={m.is_lead ? 'Lider — kliknij, by odebrać' : 'Ustaw jako lidera'}
                          className={cn('p-1 transition-colors', m.is_lead ? 'text-limona-yellow' : 'text-limona-text-dim opacity-0 group-hover:opacity-100 hover:text-limona-yellow')}
                        >
                          {m.is_lead ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(team.id, m.user_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-limona-text-dim hover:text-limona-red transition-all"
                          title="Usuń z zespołu"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => openAddMembers(team)}
                      className="text-[10px] text-limona-text-dim hover:text-limona-lime uppercase tracking-wider flex items-center gap-1 transition-colors mt-1"
                    >
                      <Plus size={11} /> Dodaj członków
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unassigned */}
          {!loading && unassigned.length > 0 && (
            <div className="limona-card p-4 border-l-[3px] border-l-limona-red">
              <h3 className="limona-eyebrow mb-4">
                <span className="flex items-center gap-2">
                  <UserX size={14} />
                  Bez przypisania do zespołu ({unassigned.length})
                </span>
              </h3>
              <div className="space-y-2">
                {unassigned.map(p => {
                  const badge = roleBadge(p.role)
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded bg-limona-surface-2/30">
                      <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                      <span className="text-sm text-limona-white flex-1 truncate">{p.full_name}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold', badge.style)}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create team */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nowy zespół" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Nazwa zespołu *</label>
            <input
              autoFocus
              required
              className="limona-input w-full"
              placeholder="np. Zespół Warszawa Centrum"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Opis (opcjonalnie)</label>
            <textarea
              className="limona-input w-full resize-none"
              rows={2}
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Członkowie</label>
            <div className="max-h-56 overflow-y-auto space-y-1 border border-limona-border rounded p-2">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-limona-surface-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-limona-lime"
                    checked={newMemberIds.includes(p.id)}
                    onChange={() => toggleNewMember(p.id)}
                  />
                  <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                  <span className="text-sm text-limona-text">{p.full_name}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-limona-text-dim mt-1">Pierwszy zaznaczony zostanie automatycznie liderem — pozostałych możesz ustawić po utworzeniu.</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={creating || !newName.trim()} className="limona-btn disabled:opacity-50">
              {creating ? 'Tworzenie...' : 'Utwórz zespół'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add members */}
      <Modal isOpen={!!addingToTeam} onClose={() => setAddingToTeam(null)} title={`Dodaj do: ${addingToTeam?.name ?? ''}`} size="md">
        <form onSubmit={handleAddMembers} className="space-y-4">
          <div className="max-h-64 overflow-y-auto space-y-1 border border-limona-border rounded p-2">
            {profiles.filter(p => !addingToTeam?.members?.some(m => m.user_id === p.id)).map(p => (
              <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-limona-surface-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-limona-lime"
                  checked={pickedMemberIds.includes(p.id)}
                  onChange={() => togglePicked(p.id)}
                />
                <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                <span className="text-sm text-limona-text">{p.full_name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setAddingToTeam(null)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={addingMembers || pickedMemberIds.length === 0} className="limona-btn disabled:opacity-50">
              {addingMembers ? 'Dodawanie...' : `Dodaj (${pickedMemberIds.length})`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete team confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Potwierdź usunięcie" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-limona-text">
              Czy na pewno usunąć zespół <span className="text-limona-white font-medium">{deleteConfirm.name}</span>?
              Grupa czatu tego zespołu zniknie z komunikacji. Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="limona-btn-outline">Anuluj</button>
              <button onClick={handleDeleteTeam} className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-6 py-3 text-sm hover:opacity-90 transition-opacity">
                Usuń
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
