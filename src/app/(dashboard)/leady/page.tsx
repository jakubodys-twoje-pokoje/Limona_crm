'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Phone, Mail, MapPin, User, Trash2, UserCheck, ArrowRight, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { canSeeAllTeams } from '@/lib/roles'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus, Profile } from '@/types/database'

const SOURCE_OPTIONS = [
  'OLX', 'Otodom', 'Morizon', 'Gratka', 'Allegro', 'Polecenie',
  'Wolne źródło', 'Komornik', 'Licytacja', 'Spis dłużników', 'Inne',
]

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new:       { label: 'Nowy',        color: 'bg-limona-border text-limona-text-muted' },
  contacted: { label: 'Skontaktowany', color: 'bg-limona-blue/20 text-limona-blue' },
  qualified: { label: 'Kwalifikowany', color: 'bg-limona-yellow/20 text-limona-yellow' },
  assigned:  { label: 'Przypisany',  color: 'bg-limona-lime/20 text-limona-lime' },
  converted: { label: 'Konwertowany', color: 'bg-limona-green/20 text-limona-green' },
  rejected:  { label: 'Odrzucony',  color: 'bg-limona-red/20 text-limona-red' },
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as LeadStatus[]

interface LeadForm {
  name: string
  phone: string
  email: string
  location: string
  source: string
  notes: string
  assignedTo: string
}

const EMPTY_FORM: LeadForm = { name: '', phone: '', email: '', location: '', source: '', notes: '', assignedTo: '' }

export default function LeadyPage() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<LeadForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [assignModal, setAssignModal] = useState<Lead | null>(null)
  const [assignTo, setAssignTo] = useState('')
  const [assignComment, setAssignComment] = useState('')
  // Każda zmiana statusu (w tym konwersja) wymaga komentarza "dlaczego"
  const [pendingAction, setPendingAction] = useState<
    { kind: 'status' | 'convert'; lead: Lead; status: LeadStatus } | null
  >(null)

  const isAdminOrManager = canSeeAllTeams(profile?.role)

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/leads?${params}`)
    if (res.ok) setLeads(await res.json())
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then(d => setProfiles(d || []))
  }, [])

  const filtered = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name.toLowerCase().includes(q)
      || l.location?.toLowerCase().includes(q)
      || l.phone?.includes(q)
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { showToast((await res.json()).error || 'Błąd', 'error'); return }
      showToast('Lead dodany', 'success')
      setShowAddModal(false)
      setForm({ ...EMPTY_FORM })
      fetchLeads()
    } finally {
      setSaving(false)
    }
  }

  function updateStatus(lead: Lead, status: LeadStatus) {
    setPendingAction({ kind: 'status', lead, status })
  }

  async function handleAssign() {
    if (!assignModal || !assignTo || !assignComment.trim()) return
    const res = await fetch(`/api/leads/${assignModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: assignTo, status: 'assigned', statusComment: assignComment.trim() }),
    })
    if (res.ok) {
      showToast('Lead przypisany', 'success')
      setAssignModal(null)
      setAssignTo('')
      setAssignComment('')
      fetchLeads()
    } else {
      showToast('Błąd przypisania', 'error')
    }
  }

  function handleConvert(lead: Lead) {
    setPendingAction({ kind: 'convert', lead, status: 'converted' })
  }

  async function confirmPendingAction(comment: string) {
    if (!pendingAction) return
    const { kind, lead, status } = pendingAction
    setPendingAction(null)

    if (kind === 'convert') {
      if (!user) return
      const noteLines = [`Lead: ${lead.name}`]
      if (lead.source) noteLines.push(`Źródło: ${lead.source}`)
      if (lead.notes) noteLines.push(lead.notes)

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adres: lead.location || lead.name,
          phone: lead.phone || null,
          notes: noteLines.join('\n'),
          assigned_to: lead.assigned_to || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        showToast(body.error || 'Błąd tworzenia nieruchomości', 'error')
        return
      }
      const newProp = await res.json()

      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted', propertyId: newProp.id, statusComment: comment }),
      })

      showToast('Skonwertowano do nieruchomości', 'success')
      router.push(`/nieruchomosci/${newProp.id}`)
      return
    }

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, statusComment: comment }),
    })
    if (res.ok) fetchLeads()
    else showToast('Błąd zmiany statusu', 'error')
  }

  async function handleDelete(lead: Lead) {
    if (!confirm(`Usunąć lead "${lead.name}"?`)) return
    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
    if (res.ok) { fetchLeads(); showToast('Usunięto', 'success') }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="limona-eyebrow">Sprzedaż</span>
          <h1 className="limona-heading text-3xl mt-1">Leady</h1>
          <p className="text-limona-text-muted text-sm mt-1">
            Zarządzanie przychodzącymi zapytaniami — od leada do nieruchomości
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="limona-btn flex items-center gap-2 flex-shrink-0">
          <Plus size={16} />
          Nowy lead
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ALL_STATUSES.map(s => {
          const count = leads.filter(l => l.status === s).length
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={cn(
                'limona-card p-3 text-center transition-all',
                statusFilter === s ? 'border-limona-lime' : 'hover:border-limona-border/80'
              )}
            >
              <p className="font-mono font-bold text-xl text-limona-white">{count}</p>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1 inline-block', cfg.color)}>
                {cfg.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted" />
        <input
          className="limona-input pl-9"
          placeholder="Szukaj po nazwisku, lokalizacji, telefonie..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="limona-card p-12 text-center">
          <User size={40} className="text-limona-text-dim mx-auto mb-3" />
          <p className="text-limona-text-muted">Brak leadów — dodaj pierwszy!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const cfg = STATUS_CONFIG[lead.status as LeadStatus]
            return (
              <div key={lead.id} className="limona-card p-4 flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-full bg-limona-lime/10 flex items-center justify-center flex-shrink-0 text-limona-lime font-bold text-sm">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-limona-white">{lead.name}</p>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider', cfg.color)}>
                      {cfg.label}
                    </span>
                    {lead.source && (
                      <span className="text-[10px] text-limona-text-dim bg-limona-surface-2 px-1.5 py-0.5 rounded">
                        {lead.source}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-limona-lime hover:opacity-80">
                        <Phone size={11} />{lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-limona-blue hover:opacity-80">
                        <Mail size={11} />{lead.email}
                      </a>
                    )}
                    {lead.location && (
                      <span className="flex items-center gap-1 text-xs text-limona-text-muted">
                        <MapPin size={11} />{lead.location}
                      </span>
                    )}
                  </div>
                  {lead.notes && (
                    <p className="text-xs text-limona-text-dim mt-1.5 line-clamp-1">{lead.notes}</p>
                  )}
                  {lead.assignee && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Avatar name={lead.assignee.full_name} url={lead.assignee.avatar_url} size="sm" />
                      <span className="text-xs text-limona-text-muted">{lead.assignee.full_name}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Status quick-advance */}
                  {lead.status === 'new' && (
                    <button onClick={() => updateStatus(lead, 'contacted')}
                      className="text-xs text-limona-blue hover:text-limona-blue/80 flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                      <Phone size={12} /> Skontaktowany
                    </button>
                  )}
                  {lead.status === 'contacted' && (
                    <button onClick={() => updateStatus(lead, 'qualified')}
                      className="text-xs text-limona-yellow hover:opacity-80 flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                      <UserCheck size={12} /> Kwalifikuj
                    </button>
                  )}
                  {(lead.status === 'new' || lead.status === 'contacted' || lead.status === 'qualified') && isAdminOrManager && (
                    <button onClick={() => { setAssignModal(lead); setAssignTo(lead.assigned_to || '') }}
                      className="text-xs text-limona-lime hover:opacity-80 flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                      <User size={12} /> Przypisz agenta
                    </button>
                  )}
                  {(lead.status === 'qualified' || lead.status === 'assigned') && (
                    <button onClick={() => handleConvert(lead)}
                      className="text-xs text-limona-green hover:opacity-80 flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                      <ArrowRight size={12} /> Konwertuj →
                    </button>
                  )}
                  {lead.status !== 'converted' && (
                    <button onClick={() => updateStatus(lead, 'rejected')}
                      className="text-xs text-limona-text-dim hover:text-limona-red flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                      Odrzuć
                    </button>
                  )}
                  <button onClick={() => handleDelete(lead)}
                    className="text-xs text-limona-text-dim hover:text-limona-red flex items-center gap-1 px-2 py-1 rounded hover:bg-limona-surface-2 transition-colors">
                    <Trash2 size={12} /> Usuń
                  </button>
                </div>

                {/* Created date */}
                <div className="text-[10px] text-limona-text-dim flex-shrink-0 self-start">
                  {new Date(lead.created_at).toLocaleDateString('pl-PL')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add lead modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nowy lead" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Imię i nazwisko właściciela *</label>
            <input required className="limona-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Jan Kowalski" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="limona-label block mb-2">Telefon</label>
              <input className="limona-input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+48 600 000 000" />
            </div>
            <div>
              <label className="limona-label block mb-2">Email</label>
              <input type="email" className="limona-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jan@gmail.com" />
            </div>
          </div>
          <div>
            <label className="limona-label block mb-2">Lokalizacja nieruchomości</label>
            <input className="limona-input" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="np. Kraków, ul. Mazowiecka 12" />
          </div>
          <div>
            <label className="limona-label block mb-2">Źródło</label>
            <input list="source-list" className="limona-input" value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              placeholder="np. OLX, Polecenie..." />
            <datalist id="source-list">
              {SOURCE_OPTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          {isAdminOrManager && (
            <div>
              <label className="limona-label block mb-2">Przypisz agenta</label>
              <select className="limona-select" value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">— Nieprzypisany —</option>
                {profiles.filter(p => p.role === 'user' || p.role === 'manager').map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="limona-label block mb-2">Notatki</label>
            <textarea className="limona-input min-h-[80px] resize-y" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Dodatkowe informacje o właścicielu / nieruchomości..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={saving} className="limona-btn disabled:opacity-50">
              {saving ? 'Dodawanie...' : 'Dodaj lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign modal */}
      <Modal isOpen={!!assignModal} onClose={() => { setAssignModal(null); setAssignComment('') }} title={`Przypisz: ${assignModal?.name}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Wybierz agenta</label>
            <select className="limona-select" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
              <option value="">— Wybierz —</option>
              {profiles.filter(p => p.role === 'user' || p.role === 'manager').map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Komentarz (dlaczego ta osoba?)</label>
            <textarea
              className="limona-input w-full min-h-[70px] resize-y text-sm"
              value={assignComment}
              onChange={e => setAssignComment(e.target.value)}
              placeholder="Np. zna lokalny rynek, ma wolny czas w tym tygodniu..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setAssignModal(null); setAssignComment('') }} className="limona-btn-outline">Anuluj</button>
            <button onClick={handleAssign} disabled={!assignTo || !assignComment.trim()} className="limona-btn disabled:opacity-50">
              Przypisz
            </button>
          </div>
        </div>
      </Modal>

      <StatusChangeCommentModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        newStatusLabel={pendingAction ? STATUS_CONFIG[pendingAction.status].label : ''}
        entityLabel="leada"
      />
    </div>
  )
}
