'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Users, Plus, Trash2, ArrowRight, Shield, Eye, UserX } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamVisibility } from '@/hooks/useTeamVisibility'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { canManageTeams, ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types/database'

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
  const { user, profile } = useAuth()
  const { rules, profiles, loading, addRule, removeRule } = useTeamVisibility()
  const { showToast } = useToast()
  const canManage = canManageTeams(profile?.role)

  const [managerId, setManagerId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!managerId || !memberId || !user) return
    if (managerId === memberId) {
      showToast('Manager i członek nie mogą być tą samą osobą', 'error')
      return
    }
    setAdding(true)
    const { error } = await addRule(managerId, memberId, user.id)
    if (error) showToast(error, 'error')
    else {
      showToast('Reguła dodana', 'success')
      setManagerId('')
      setMemberId('')
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    const { error } = await removeRule(id)
    if (error) showToast(error, 'error')
    else showToast('Reguła usunięta', 'success')
  }

  // Group rules by manager
  const byManager = rules.reduce<Record<string, typeof rules>>((acc, rule) => {
    const key = rule.manager_id
    if (!acc[key]) acc[key] = []
    acc[key].push(rule)
    return acc
  }, {})

  const managerIds = new Set(Object.keys(byManager))
  const memberIds = new Set(rules.map(r => r.member_id))
  const unassigned = profiles.filter(p => p.role !== 'admin' && !managerIds.has(p.id) && !memberIds.has(p.id))

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Administracja</span>
        <h1 className="limona-heading text-3xl mt-1">Zespół</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Kto jest kierownikiem czego — zarządzaj grupami i widocznością zadań
        </p>
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
              <p className="text-2xl font-bold text-limona-yellow">{managerIds.size}</p>
              <p className="text-[10px] uppercase tracking-wider text-limona-text-muted mt-1">Zespołów / kierowników</p>
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
              <li><span className="text-limona-yellow">Manager</span> — widzi swoje + zadania przypisanych członków</li>
              <li><span className="text-limona-text">Pracownik</span> — widzi tylko swoje zadania</li>
            </ul>
          </div>

          {/* Add rule */}
          <div className="limona-card p-4">
            <h3 className="limona-eyebrow mb-4">Dodaj regułę widoczności</h3>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-limona-text-muted uppercase tracking-wider mb-2">
                  Manager (widzi zadania)
                </label>
                <select
                  className="limona-select"
                  value={managerId}
                  onChange={e => setManagerId(e.target.value)}
                  required
                >
                  <option value="">Wybierz managera...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.role === 'admin' ? '(admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight size={18} className="text-limona-text-dim hidden sm:block flex-shrink-0 mb-3" />

              <div className="flex-1 w-full">
                <label className="block text-xs text-limona-text-muted uppercase tracking-wider mb-2">
                  Członek (którego zadania widzi)
                </label>
                <select
                  className="limona-select"
                  value={memberId}
                  onChange={e => setMemberId(e.target.value)}
                  required
                >
                  <option value="">Wybierz członka...</option>
                  {profiles.filter(p => p.id !== managerId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={adding || !managerId || !memberId}
                className="limona-btn-sm flex items-center gap-2 disabled:opacity-40 flex-shrink-0"
              >
                <Plus size={14} />
                Dodaj
              </button>
            </form>
          </div>

          {/* Members list */}
          <div className="limona-card p-4">
            <h3 className="limona-eyebrow mb-4">Członkowie zespołu</h3>
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : profiles.length === 0 ? (
              <p className="text-limona-text-muted text-center py-6">Brak użytkowników</p>
            ) : (
              <div className="space-y-2">
                {profiles.map(p => {
                  const badge = roleBadge(p.role)
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded bg-limona-surface-2/30">
                      <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-limona-white truncate">{p.full_name}</p>
                        <p className="text-xs text-limona-text-dim">{p.id.slice(0, 8)}...</p>
                      </div>
                      {managerIds.has(p.id) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-limona-surface-2 text-limona-text-dim">
                          Kierownik zespołu
                        </span>
                      )}
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold', badge.style)}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Current visibility rules — kto jest kierownikiem czego */}
          <div className="limona-card p-4">
            <h3 className="limona-eyebrow mb-4">
              <span className="flex items-center gap-2">
                <Eye size={14} />
                Kto jest kierownikiem czego ({managerIds.size} {managerIds.size === 1 ? 'zespół' : 'zespoły'})
              </span>
            </h3>
            {loading ? (
              <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-limona-text-muted text-sm">Brak reguł — domyślnie każdy widzi tylko swoje zadania</p>
                <p className="text-limona-text-dim text-xs mt-1">Admin zawsze widzi wszystko</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(byManager).map(([mgrId, mgrRules]) => {
                  const mgr = mgrRules[0]?.manager
                  const badge = roleBadge(mgr?.role || 'manager')
                  return (
                    <div key={mgrId} className="limona-card p-3 border-l-[3px] border-l-limona-yellow">
                      <div className="flex items-center gap-2 mb-2">
                        {mgr && <Avatar name={mgr.full_name} url={mgr.avatar_url} size="sm" />}
                        <span className="text-sm font-medium text-limona-white">
                          {mgr?.full_name || mgrId.slice(0, 8)}
                        </span>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold', badge.style)}>
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-limona-text-dim uppercase tracking-wider">
                          {mgrRules.length} {mgrRules.length === 1 ? 'osoba' : 'osób'}
                        </span>
                      </div>
                      <div className="pl-9 space-y-1">
                        <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-1">Widzi zadania:</p>
                        {mgrRules.map(rule => (
                          <div key={rule.id} className="flex items-center gap-2 group">
                            <div className="w-1.5 h-1.5 bg-limona-text-dim rounded-full" />
                            {rule.member && (
                              <Avatar name={rule.member.full_name} url={rule.member.avatar_url} size="sm" />
                            )}
                            <span className="text-sm text-limona-text flex-1">
                              {rule.member?.full_name || rule.member_id.slice(0, 8)}
                            </span>
                            <button
                              onClick={() => handleRemove(rule.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-limona-text-dim hover:text-limona-red transition-all"
                              title="Usuń regułę"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Unassigned — nie są ani kierownikiem, ani członkiem żadnej grupy */}
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
    </div>
  )
}
