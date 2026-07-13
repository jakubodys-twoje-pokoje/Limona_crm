'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Phone, MapPin, Tag, Search, AlertTriangle, ChevronDown, ChevronRight,
  Copy, Check, Webhook,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { LeadDetailModal, TEMPERATURE_CONFIG, LEAD_STATUS_COLORS } from '@/components/leads/LeadDetailModal'
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal'
import { LEAD_STATUS_LABELS } from '@/lib/status-comments'
import { LEAD_TRANSITIONS } from '@/lib/lead-rules'
import { canSeeAllTeams } from '@/lib/roles'
import { cn, isOverdueDate } from '@/lib/utils'
import type { Lead, LeadStatus, LeadTemperature, Profile } from '@/types/database'

const SOURCE_OPTIONS = [
  'OLX', 'Otodom', 'Morizon', 'Gratka', 'Allegro', 'Polecenie',
  'Wolne źródło', 'Komornik', 'Licytacja', 'Spis dłużników', 'Inne',
]

// Aktywny pipeline — kolumny kanbanu; converted/rejected to sekcje archiwum
const PIPELINE: LeadStatus[] = ['new', 'contacted', 'qualified', 'assigned']

interface LeadForm {
  name: string
  phone: string
  email: string
  location: string
  source: string
  notes: string
  assignedTo: string
  temperature: LeadTemperature
  nextContactAt: string
}

const EMPTY_FORM: LeadForm = {
  name: '', phone: '', email: '', location: '', source: '', notes: '',
  assignedTo: '', temperature: 'warm', nextContactAt: '',
}

export default function LeadyPage() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const canManage = canSeeAllTeams(profile?.role)

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Filtry
  const [search, setSearch] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  // Modale
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<LeadForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  // Drag&drop między kolumnami — zmiana statusu wymaga komentarza
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; status: LeadStatus } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Archiwum (converted/rejected) — zwijane sekcje
  const [showConverted, setShowConverted] = useState(false)
  const [showRejected, setShowRejected] = useState(false)

  // Webhook info (dla adminów) — jak podpiąć n8n
  const [showWebhookInfo, setShowWebhookInfo] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/leads')
    if (res.ok) setLeads(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const profilesFetched = useRef(false)
  useEffect(() => {
    if (profilesFetched.current) return
    profilesFetched.current = true
    fetch('/api/profiles').then(r => r.json()).then(d => setProfiles(d || []))
  }, [])

  // Modal szczegółów zawsze pokazuje świeże dane po refetchu
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find(l => l.id === selectedLead.id)
      if (updated) setSelectedLead(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads])

  const filtered = useMemo(() => leads.filter(l => {
    if (tempFilter && l.temperature !== tempFilter) return false
    if (assigneeFilter && l.assigned_to !== assigneeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(l.name.toLowerCase().includes(q)
        || l.location?.toLowerCase().includes(q)
        || l.phone?.includes(q)
        || l.email?.toLowerCase().includes(q))) return false
    }
    return true
  }), [leads, tempFilter, assigneeFilter, search])

  const byStatus = useCallback(
    (status: LeadStatus) => filtered.filter(l => l.status === status),
    [filtered],
  )

  async function updateLead(id: string, updates: Record<string, unknown>): Promise<{ error: string | null }> {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const err = (await res.json()).error || 'Błąd'
      showToast(err, 'error')
      return { error: err }
    }
    fetchLeads()
    return { error: null }
  }

  async function deleteLead(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (!res.ok) showToast((await res.json()).error || 'Błąd usuwania', 'error')
    else { showToast('Lead usunięty', 'success'); fetchLeads() }
  }

  async function handleAdd(e: React.FormEvent, force = false) {
    e.preventDefault()
    setSaving(true)
    setDuplicateWarning(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, force }),
      })
      if (res.status === 409) {
        setDuplicateWarning((await res.json()).error)
        return
      }
      if (!res.ok) { showToast((await res.json()).error || 'Błąd', 'error'); return }
      showToast('Lead dodany', 'success')
      setShowAddModal(false)
      setForm({ ...EMPTY_FORM })
      fetchLeads()
    } finally {
      setSaving(false)
    }
  }

  async function confirmMove(comment: string) {
    if (!pendingMove) return
    const { lead, status } = pendingMove
    setPendingMove(null)
    await updateLead(lead.id, { status, statusComment: comment })
  }

  function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const leadId = e.dataTransfer.getData('text/plain')
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === status) return
    if (!LEAD_TRANSITIONS[lead.status]?.includes(status)) {
      showToast(`Nie można przenieść z „${LEAD_STATUS_LABELS[lead.status]}" do „${LEAD_STATUS_LABELS[status]}"`, 'error')
      return
    }
    setPendingMove({ lead, status })
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/leads` : '/api/webhooks/leads'

  const convertedLeads = filtered.filter(l => l.status === 'converted')
  const rejectedLeads = filtered.filter(l => l.status === 'rejected')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="limona-eyebrow">Pozyskiwanie</span>
          <h1 className="limona-heading text-3xl mt-1">Leady</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <button onClick={() => setShowWebhookInfo(true)}
              className="limona-btn-outline text-xs flex items-center gap-1.5 px-4 py-2">
              <Webhook size={13} /> Webhook n8n
            </button>
          )}
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setDuplicateWarning(null); setShowAddModal(true) }}
            className="limona-btn-sm flex items-center gap-1.5">
            <Plus size={14} /> Nowy lead
          </button>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted pointer-events-none" />
          <input className="limona-input pl-8 text-sm py-2" placeholder="Szukaj po nazwie, telefonie..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="limona-select w-auto text-xs py-2" value={tempFilter} onChange={e => setTempFilter(e.target.value)}>
          <option value="">Każda temperatura</option>
          {(Object.keys(TEMPERATURE_CONFIG) as LeadTemperature[]).map(t => (
            <option key={t} value={t}>{TEMPERATURE_CONFIG[t].label}</option>
          ))}
        </select>
        {canManage && (
          <select className="limona-select w-auto text-xs py-2" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
            <option value="">Wszyscy agenci</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
      </div>

      {/* Pipeline */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE.map(status => {
            const columnLeads = byStatus(status)
            return (
              <div
                key={status}
                onDragOver={e => { e.preventDefault(); setDragOverCol(status) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, status)}
                className={cn(
                  'rounded-lg border-2 border-t-4 p-3 space-y-2 min-h-[220px] transition-colors',
                  dragOverCol === status ? 'border-limona-lime bg-limona-lime/5' : 'border-limona-border/50',
                  status === 'new' && 'border-t-gray-500',
                  status === 'contacted' && 'border-t-[#448AFF]',
                  status === 'qualified' && 'border-t-[#FFD600]',
                  status === 'assigned' && 'border-t-limona-lime',
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-limona-text-muted">
                    {LEAD_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs font-mono text-limona-text-dim">{columnLeads.length}</span>
                </div>
                {columnLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedLead(lead)} />
                ))}
                {columnLeads.length === 0 && (
                  <p className="text-center text-[11px] text-limona-text-dim py-6">Pusto — przeciągnij tu leada</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Archiwum: converted / rejected */}
      <div className="space-y-2 pt-2">
        <ArchiveSection
          label={`Skonwertowane (${convertedLeads.length})`}
          color="text-limona-green"
          open={showConverted}
          onToggle={() => setShowConverted(v => !v)}
          leads={convertedLeads}
          onOpen={setSelectedLead}
        />
        <ArchiveSection
          label={`Odrzucone (${rejectedLeads.length})`}
          color="text-limona-red"
          open={showRejected}
          onToggle={() => setShowRejected(v => !v)}
          leads={rejectedLeads}
          onOpen={setSelectedLead}
        />
      </div>

      {/* Modal dodawania */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nowy lead" size="md">
        <form onSubmit={e => handleAdd(e)} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Imię i nazwisko / nazwa *</label>
            <input required autoFocus className="limona-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Telefon</label>
              <input className="limona-input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="600 000 000" />
            </div>
            <div>
              <label className="limona-label block mb-2">Email</label>
              <input type="email" className="limona-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <p className="text-[10px] text-limona-text-dim -mt-2">Telefon lub email jest wymagany — po nich pilnujemy duplikatów.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Lokalizacja</label>
              <input className="limona-input" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Miasto / adres" />
            </div>
            <div>
              <label className="limona-label block mb-2">Źródło</label>
              <select className="limona-select" value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="">—</option>
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Temperatura</label>
              <select className="limona-select" value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: e.target.value as LeadTemperature }))}>
                {(Object.keys(TEMPERATURE_CONFIG) as LeadTemperature[]).map(t => (
                  <option key={t} value={t}>{TEMPERATURE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="limona-label block mb-2">Następny kontakt</label>
              <input type="date" className="limona-input" value={form.nextContactAt}
                onChange={e => setForm(f => ({ ...f, nextContactAt: e.target.value }))} />
            </div>
          </div>
          {canManage && (
            <div>
              <label className="limona-label block mb-2">Przypisz agenta</label>
              <select className="limona-select" value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">— nieprzypisany —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="limona-label block mb-2">Notatki</label>
            <textarea className="limona-input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {duplicateWarning && (
            <div className="rounded-lg border border-limona-yellow/60 bg-limona-yellow/10 p-3 space-y-2">
              <p className="flex items-center gap-2 text-sm text-limona-yellow">
                <AlertTriangle size={14} className="flex-shrink-0" /> {duplicateWarning}
              </p>
              <button type="button" onClick={e => handleAdd(e as unknown as React.FormEvent, true)}
                className="text-xs text-limona-text-muted hover:text-limona-yellow underline">
                Dodaj mimo to (świadomie tworzę duplikat)
              </button>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={saving} className="limona-btn disabled:opacity-50">
              {saving ? 'Dodawanie...' : 'Dodaj leada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal szczegółów */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onDelete={canManage ? deleteLead : null}
          onConvert={() => { setConvertLead(selectedLead); setSelectedLead(null) }}
          userId={user?.id || ''}
          userName={profile?.full_name || ''}
          isAdmin={profile?.role === 'admin'}
          canAssign={canManage}
          profiles={profiles}
        />
      )}

      {/* Modal konwersji */}
      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          isOpen={!!convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={({ propertyId, kontaktId }) => {
            fetchLeads()
            showToast(
              `Lead skonwertowany${propertyId ? ' — nieruchomość utworzona' : ''}${kontaktId ? ' — klient utworzony' : ''}`,
              'success',
            )
          }}
        />
      )}

      {/* Komentarz przy przeciągnięciu do innej kolumny */}
      <StatusChangeCommentModal
        isOpen={!!pendingMove}
        onClose={() => setPendingMove(null)}
        onConfirm={confirmMove}
        newStatusLabel={pendingMove ? LEAD_STATUS_LABELS[pendingMove.status] : ''}
        entityLabel="leada"
      />

      {/* Instrukcja webhooka (admin) */}
      <Modal isOpen={showWebhookInfo} onClose={() => setShowWebhookInfo(false)} title="Webhook — podpięcie n8n" size="md">
        <div className="space-y-4 text-sm text-limona-text">
          <div>
            <p className="limona-label mb-1 text-[10px]">Endpoint (metoda POST)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-limona-surface-2 rounded px-3 py-2 text-xs font-mono break-all">{webhookUrl}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(webhookUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1500) }}
                className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors flex-shrink-0"
              >
                {copiedUrl ? <Check size={14} className="text-limona-green" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div>
            <p className="limona-label mb-1 text-[10px]">Autoryzacja</p>
            <p className="text-xs text-limona-text-muted">
              Nagłówek <code className="text-limona-lime">Authorization: Bearer &lt;sekret&gt;</code> albo{' '}
              <code className="text-limona-lime">X-Webhook-Secret: &lt;sekret&gt;</code>.
              Sekret ustawia się w zmiennej środowiskowej <code className="text-limona-lime">LEADS_WEBHOOK_SECRET</code> na serwerze.
            </p>
          </div>
          <div>
            <p className="limona-label mb-1 text-[10px]">Payload (JSON)</p>
            <pre className="bg-limona-surface-2 rounded px-3 py-2 text-[11px] font-mono overflow-x-auto">{`{
  "name": "Jan Kowalski",        // wymagane
  "phone": "600 000 000",        // telefon LUB email wymagany
  "email": "jan@example.com",
  "location": "Wrocław, Krzyki",
  "source": "landing-olx",
  "notes": "Zadłużone mieszkanie 48m2",
  "temperature": "hot"           // hot | warm | cold
}`}</pre>
          </div>
          <p className="text-xs text-limona-text-muted">
            Duplikaty (ten sam telefon/email) nie tworzą drugiego leada — system dokleja komentarz
            „ponowne zgłoszenie" do istniejącego i powiadamia prowadzącego agenta.
          </p>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Karta leada w kolumnie ─── */
function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const followUpOverdue = lead.next_contact_at && isOverdueDate(lead.next_contact_at)
  const temp = TEMPERATURE_CONFIG[lead.temperature]
  const resubmissions = typeof lead.meta?.webhook_resubmissions === 'number' ? lead.meta.webhook_resubmissions as number : 0
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={onOpen}
      className="limona-card p-3 space-y-1.5 cursor-grab active:cursor-grabbing hover:border-limona-lime/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-limona-white leading-snug">{lead.name}</p>
        <span className={cn('flex-shrink-0 mt-0.5', temp.color)} title={temp.label}>{temp.icon}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-limona-text-dim">
        {lead.phone && <span className="flex items-center gap-0.5"><Phone size={9} />{lead.phone}</span>}
        {lead.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{lead.location}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {lead.source && (
          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-limona-border/40 text-limona-text-muted uppercase tracking-wider">
            <Tag size={8} />{lead.source}
          </span>
        )}
        {followUpOverdue && (
          <span className="flex items-center gap-0.5 text-[9px] text-limona-red uppercase tracking-wider">
            <AlertTriangle size={9} /> Kontakt zaległy
          </span>
        )}
        {resubmissions > 0 && (
          <span className="text-[9px] text-limona-yellow uppercase tracking-wider" title="Ponowne zgłoszenia z webhooka">
            ↻ {resubmissions}×
          </span>
        )}
        {lead.assignee && (
          <span className="ml-auto"><Avatar name={lead.assignee.full_name} url={lead.assignee.avatar_url} size="sm" /></span>
        )}
      </div>
    </div>
  )
}

/* ─── Zwijana sekcja archiwum ─── */
function ArchiveSection({ label, color, open, onToggle, leads, onOpen }: {
  label: string
  color: string
  open: boolean
  onToggle: () => void
  leads: Lead[]
  onOpen: (l: Lead) => void
}) {
  return (
    <div className="rounded-lg border border-limona-border/50">
      <button onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-left">
        {open ? <ChevronDown size={13} className="text-limona-text-dim" /> : <ChevronRight size={13} className="text-limona-text-dim" />}
        <span className={color}>{label}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {leads.length === 0 ? (
            <p className="text-xs text-limona-text-dim py-2">Brak</p>
          ) : leads.map(lead => (
            <button key={lead.id} onClick={() => onOpen(lead)}
              className="limona-card p-2.5 text-left hover:border-limona-lime/40 transition-colors">
              <p className="text-sm text-limona-text truncate">{lead.name}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-limona-text-dim">
                {lead.phone && <span>{lead.phone}</span>}
                <span className={cn('limona-badge text-[8px] px-2 py-0', LEAD_STATUS_COLORS[lead.status])}>
                  {LEAD_STATUS_LABELS[lead.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
