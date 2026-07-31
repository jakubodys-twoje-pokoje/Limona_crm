'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Plus, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { canManageTeams } from '@/lib/roles'
import { ACCESS_SCOPES, ACCESS_SCOPE_LABELS } from '@/lib/access'
import { ROLE_LABELS } from '@/lib/roles'
import type { Profile } from '@/types/database'

interface AccessGrant {
  id: string
  scope: string
  target_user_id: string | null
  grantee?: { id: string; full_name: string; avatar_url: string | null }
  target?: { id: string; full_name: string; avatar_url: string | null } | null
}

export default function DostepyPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const canManage = canManageTeams(profile?.role)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [granteeId, setGranteeId] = useState('')
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [allGrants, setAllGrants] = useState<AccessGrant[]>([])
  const [loadingAll, setLoadingAll] = useState(true)

  // Formularz nadania
  const [scope, setScope] = useState<string>(ACCESS_SCOPES[0])
  const [targetUserId, setTargetUserId] = useState('') // '' = cała kategoria
  const [saving, setSaving] = useState(false)

  const profilesFetched = useRef(false)
  useEffect(() => {
    if (profilesFetched.current) return
    profilesFetched.current = true
    fetch('/api/profiles').then(r => r.ok ? r.json() : []).then(setProfiles).catch(() => {})
  }, [])

  // Dostęp tylko dla admina/kierownika centrali
  useEffect(() => {
    if (!authLoading && profile && !canManage) router.replace('/dashboard')
  }, [authLoading, profile, canManage, router])

  async function loadGrants(id: string) {
    if (!id) { setGrants([]); return }
    setLoadingGrants(true)
    const res = await fetch(`/api/access-grants?granteeId=${id}`)
    if (res.ok) setGrants(await res.json())
    setLoadingGrants(false)
  }

  async function loadAll() {
    setLoadingAll(true)
    const res = await fetch('/api/access-grants')
    if (res.ok) setAllGrants(await res.json())
    setLoadingAll(false)
  }

  useEffect(() => { loadGrants(granteeId) }, [granteeId])
  useEffect(() => { if (canManage) loadAll() }, [canManage])

  // Podgląd zbiorczy — granty pogrupowane po użytkowniku (kto ma dostęp do czego)
  const groupedAll = useMemo(() => {
    const map = new Map<string, { grantee: AccessGrant['grantee']; grants: AccessGrant[] }>()
    for (const g of allGrants) {
      const key = g.grantee?.id ?? 'nieznany'
      if (!map.has(key)) map.set(key, { grantee: g.grantee, grants: [] })
      map.get(key)!.grants.push(g)
    }
    return [...map.values()].sort((a, b) => (a.grantee?.full_name ?? '').localeCompare(b.grantee?.full_name ?? '', 'pl'))
  }, [allGrants])

  const targetOptions = useMemo(
    () => profiles.filter(p => p.id !== granteeId),
    [profiles, granteeId],
  )

  async function addGrant() {
    if (!granteeId || !scope) return
    setSaving(true)
    const res = await fetch('/api/access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granteeId, scope, targetUserId: targetUserId || null }),
    })
    setSaving(false)
    if (!res.ok) { showToast((await res.json().catch(() => ({}))).error || 'Nie udało się nadać dostępu', 'error'); return }
    showToast('Dostęp nadany', 'success')
    setTargetUserId('')
    loadGrants(granteeId)
    loadAll()
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/access-grants/${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Nie udało się cofnąć dostępu', 'error'); return }
    setGrants(prev => prev.filter(g => g.id !== id))
    setAllGrants(prev => prev.filter(g => g.id !== id))
  }

  if (authLoading || !profile) return null
  if (!canManage) return null

  const granteeProfile = profiles.find(p => p.id === granteeId)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <span className="limona-eyebrow flex items-center gap-2"><ShieldCheck size={14} /> Uprawnienia</span>
        <h1 className="limona-heading text-3xl mt-1">Panel dostępów</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Nadawaj użytkownikom dostęp do wybranych kategorii — całej kategorii (np. wszyscy inwestorzy)
          albo rekordów konkretnej osoby (np. nieruchomości wybranego agenta).
        </p>
      </div>

      {/* Wybór użytkownika */}
      <div className="limona-card p-5">
        <label className="limona-label block mb-2">Użytkownik, któremu nadajesz dostęp</label>
        <select className="limona-select w-full max-w-md" value={granteeId} onChange={e => setGranteeId(e.target.value)}>
          <option value="">— wybierz użytkownika —</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name} · {ROLE_LABELS[p.role] ?? p.role}</option>
          ))}
        </select>
      </div>

      {granteeId && (
        <>
          {/* Nadanie nowego dostępu */}
          <div className="limona-card p-5 space-y-4">
            <p className="limona-eyebrow flex items-center gap-2"><UserPlus size={14} /> Nadaj dostęp</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="limona-label block mb-1.5">Kategoria</label>
                <select className="limona-select w-full" value={scope} onChange={e => setScope(e.target.value)}>
                  {ACCESS_SCOPES.map(s => <option key={s} value={s}>{ACCESS_SCOPE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="limona-label block mb-1.5">Zakres</label>
                <select className="limona-select w-full" value={targetUserId} onChange={e => setTargetUserId(e.target.value)}>
                  <option value="">Cała kategoria (wszyscy)</option>
                  {targetOptions.map(p => <option key={p.id} value={p.id}>Rekordy: {p.full_name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addGrant} disabled={saving} className="limona-btn-sm flex items-center gap-1.5 disabled:opacity-50 w-full sm:w-auto justify-center">
                  <Plus size={14} /> Nadaj
                </button>
              </div>
            </div>
          </div>

          {/* Lista dostępów */}
          <div className="limona-card p-5">
            <p className="limona-eyebrow mb-3">
              Dostępy użytkownika {granteeProfile ? `— ${granteeProfile.full_name}` : ''}
            </p>
            {loadingGrants ? (
              <p className="text-sm text-limona-text-muted py-4">Ładowanie…</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-limona-text-dim py-4 text-center">Brak dodatkowych dostępów — user widzi tylko swoje (i zespołu).</p>
            ) : (
              <div className="space-y-2">
                {grants.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded bg-limona-surface-2/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-limona-text font-medium">{ACCESS_SCOPE_LABELS[g.scope] ?? g.scope}</p>
                      <p className="text-xs text-limona-text-dim mt-0.5">
                        {g.target_user_id
                          ? <span className="flex items-center gap-1.5">Rekordy: {g.target?.full_name ?? '—'}</span>
                          : 'Cała kategoria (wszyscy właściciele)'}
                      </p>
                    </div>
                    {g.target && <Avatar name={g.target.full_name} url={g.target.avatar_url} size="sm" />}
                    <button onClick={() => revoke(g.id)} className="p-1.5 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0" title="Cofnij dostęp">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Podgląd zbiorczy — kto ma dostęp do czego */}
      <div className="limona-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="limona-eyebrow">Podgląd zbiorczy — wszystkie dostępy</p>
          {!loadingAll && <span className="text-xs text-limona-text-dim">{allGrants.length} nadanych</span>}
        </div>
        {loadingAll ? (
          <p className="text-sm text-limona-text-muted py-4">Ładowanie…</p>
        ) : groupedAll.length === 0 ? (
          <p className="text-sm text-limona-text-dim py-4 text-center">Nikt nie ma jeszcze dodatkowych dostępów.</p>
        ) : (
          <div className="space-y-3">
            {groupedAll.map(group => (
              <div key={group.grantee?.id ?? 'x'} className="rounded-lg border border-limona-border/50 p-3">
                <button
                  onClick={() => group.grantee && setGranteeId(group.grantee.id)}
                  className="flex items-center gap-2 mb-2 text-left group"
                  title="Edytuj dostępy tego użytkownika"
                >
                  {group.grantee && <Avatar name={group.grantee.full_name} url={group.grantee.avatar_url} size="sm" />}
                  <span className="text-sm font-medium text-limona-white group-hover:text-limona-lime transition-colors">
                    {group.grantee?.full_name ?? 'Nieznany użytkownik'}
                  </span>
                  <span className="text-xs text-limona-text-dim">({group.grants.length})</span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {group.grants.map(g => (
                    <span key={g.id} className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-limona-border bg-limona-surface-2/50 pl-2.5 pr-1.5 py-1">
                      <span className="text-limona-text">{ACCESS_SCOPE_LABELS[g.scope] ?? g.scope}</span>
                      <span className="text-limona-text-dim">
                        {g.target_user_id ? `· ${g.target?.full_name ?? '—'}` : '· wszyscy'}
                      </span>
                      <button onClick={() => revoke(g.id)} className="text-limona-text-dim hover:text-limona-red transition-colors" title="Cofnij">
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
