'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Clock, User, Phone, Plus, CheckCircle, Circle, Trash2, Layers, FileText, ExternalLink, Square, CheckSquare, Building2, Compass, MessageSquare, Users, X, Save } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProperties } from '@/hooks/useProperties'
import { useTasks } from '@/hooks/useTasks'
import { useActivityLog } from '@/hooks/useActivityLog'
import { useToast } from '@/components/ui/Toast'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatMoney, formatPropertyAddress, cn, sortByCreatedAt, type SortDirection } from '@/lib/utils'
import { SortToggle } from '@/components/ui/SortToggle'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { InvestorOfferCard } from '@/components/properties/InvestorOfferCard'
import { PropertyComments } from '@/components/properties/PropertyComments'
import { sumLineItems } from '@/lib/calculator'
import { canSeeInvestors, canSeeAllTeams } from '@/lib/roles'
import type { Property, Task, Document, PropertyNegotiationNote, PropertyInvestor, StatusDluznika, StatusInwestora, InvestorPropertyStatus, ChecklistItemState, Profile } from '@/types/database'
import {
  STAGE_TASK_TEMPLATES, DEAL_TYPE_LABELS,
  STATUS_DLUZNIKA_OPTIONS, STATUS_DLUZNIKA_LABELS, STATUS_INWESTORA_OPTIONS, STATUS_INWESTORA_LABELS,
  getStatusDluznikaLabel,
} from '@/lib/stages'
import type { DealType } from '@/types/database'
import { AgentReport } from '@/components/properties/AgentReport'

const CHECKLIST_INFO = [
  'Zweryfikowana księga wieczysta', 'Kontakt z właścicielem', 'Umowa podpisana',
  'Pełnomocnictwo do zbierania dokumentów o saldzie zadłużenia', 'Pełnomocnictwo do negocjacji',
  'Rzut / metraż', 'Rok budowy', 'Piętro i układ', 'Stan techniczny oceniony',
  'Czynsz miesięczny', 'Wycena szacunkowa', 'Zdjęcia wykonane', 'Zadłużenie potwierdzone',
]
const CHECKLIST_DOCS = [
  'Akt własności / odpis KW', 'Zaświadczenie salda od komornika',
  'Zaświadczenie ze spółdzielni o stanie zaległości lub niezaleganiu',
  'Zaświadczenie o stanie zaległości US (jeśli dotyczy)',
  'Zaświadczenie o stanie zaległości ZUS (jeśli dotyczy)',
  'Zaświadczenie o stanie zaległości Urząd Miasta (jeśli dotyczy)',
  'Zaświadczenie z urzędu skarbowego (jeśli nabyte darowizną lub spadek)',
  'Poprzedni akt notarialny nabycia nieruchomości', 'Pełnomocnictwo (jeśli dotyczy)',
  'Umowa przedwstępna sprzedaży (jeśli dotyczy)', 'Protokół zdawczo-odbiorczy',
]

const KW_DZIALY = [
  ['kw_dzial1_komentarz', 'Dział I — oznaczenie nieruchomości'],
  ['kw_dzial2_komentarz', 'Dział II — własność'],
  ['kw_dzial3_komentarz', 'Dział III — ciężary i ograniczenia'],
  ['kw_dzial4_komentarz', 'Dział IV — hipoteki'],
] as const

function formatChecklistMeta(state: ChecklistItemState | undefined): string | null {
  if (!state?.checked) return null
  const who = state.checked_by_name || 'Ktoś'
  const when = state.checked_at ? new Date(state.checked_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : ''
  return when ? `${who}, ${when}` : who
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    created: 'Dodano nieruchomość',
    updated: 'Zaktualizowano dane',
    status_changed: 'Zmieniono status',
    note_added: 'Dodano notatkę',
    task_created: 'Dodano zadanie',
  }
  return map[action] || action
}

interface KontaktOption { id: string; nazwa: string; typ: string; telefon: string | null; email: string | null }

export default function PropertyDetailPage() {
  const { id } = useParams()
  const propertyId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { user, profile } = useAuth()
  const { updateProperty, deleteProperty } = useProperties()
  const { tasks, createTask, updateTask, deleteTask } = useTasks(propertyId)
  const { logs, loading: logsLoading } = useActivityLog(propertyId)
  const { showToast } = useToast()
  const canAssign = canSeeAllTeams(profile?.role)

  const [property, setProperty] = useState<Property | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProp, setLoadingProp] = useState(true)
  const [activeTab, setActiveTab] = useState<'komentarze' | 'tasks' | 'docs' | 'checklist' | 'negocjacja' | 'inwestorzy' | 'log' | 'report'>('tasks')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocUrl, setNewDocUrl] = useState('')
  const [newDocType, setNewDocType] = useState('')
  const [addingDoc, setAddingDoc] = useState(false)
  const [kwForm, setKwForm] = useState<Record<string, string>>({})
  const [savingKw, setSavingKw] = useState(false)

  // Status change (dłużnik/inwestor)
  const [statusChange, setStatusChange] = useState<{ field: 'status_dluznika' | 'status_inwestora'; value: string; label: string } | null>(null)

  // Długa notatka domyślnie zwinięta do kilku linijek
  const [notesExpanded, setNotesExpanded] = useState(false)

  // Negocjacja
  const [negNotes, setNegNotes] = useState<PropertyNegotiationNote[]>([])
  const [negLoading, setNegLoading] = useState(false)
  const [newNegNote, setNewNegNote] = useState('')
  const [negSortDir, setNegSortDir] = useState<SortDirection>('desc')

  // Inwestorzy
  const [investors, setInvestors] = useState<PropertyInvestor[]>([])
  const [investorsLoading, setInvestorsLoading] = useState(false)
  const [investorKontakty, setInvestorKontakty] = useState<KontaktOption[]>([])
  const [investorSearch, setInvestorSearch] = useState('')
  const [showNewInvestor, setShowNewInvestor] = useState(false)
  const [newInvestorName, setNewInvestorName] = useState('')
  const [newInvestorPhone, setNewInvestorPhone] = useState('')

  async function toggleCheck(item: string) {
    if (!user || !property || !propertyId) return
    const wasChecked = property.checklist?.[item]?.checked
    const nextState: ChecklistItemState = wasChecked
      ? { checked: false, checked_by: null, checked_by_name: null, checked_at: null }
      : { checked: true, checked_by: user.id, checked_by_name: profile?.full_name || null, checked_at: new Date().toISOString() }
    const nextChecklist = { ...(property.checklist || {}), [item]: nextState }
    setProperty(prev => prev ? { ...prev, checklist: nextChecklist } : prev)
    const { error } = await updateProperty(propertyId, { checklist: nextChecklist }, user.id)
    if (error) showToast(error, 'error')
  }

  async function fetchDocs() {
    setDocsLoading(true)
    const res = await fetch(`/api/documents?propertyId=${propertyId}`)
    if (res.ok) setDocuments(await res.json())
    setDocsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'docs') fetchDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, propertyId])

  async function fetchNegotiation() {
    setNegLoading(true)
    const res = await fetch(`/api/properties/${propertyId}/negotiation`)
    if (res.ok) setNegNotes(await res.json())
    setNegLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'negocjacja') fetchNegotiation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, propertyId])

  async function fetchInvestors() {
    setInvestorsLoading(true)
    const [invRes, kontaktyRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}/investors`),
      fetch('/api/kontakty?limit=500'),
    ])
    if (invRes.ok) setInvestors(await invRes.json())
    if (kontaktyRes.ok) {
      const data: KontaktOption[] = await kontaktyRes.json()
      setInvestorKontakty(data.filter(k => k.typ === 'inwestor'))
    }
    setInvestorsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'inwestorzy') fetchInvestors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, propertyId])

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!newDocName.trim() || !newDocUrl.trim()) return
    setAddingDoc(true)
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        name: newDocName.trim(),
        file_url: newDocUrl.trim(),
        file_type: newDocType || null,
        stage: property?.status_dluznika || null,
      }),
    })
    if (res.ok) {
      setNewDocName(''); setNewDocUrl(''); setNewDocType('')
      fetchDocs()
    }
    setAddingDoc(false)
  }

  async function handleDeleteDoc(id: string) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  async function handleSaveKw() {
    if (!user) return
    setSavingKw(true)
    const { error } = await updateProperty(currentPropertyId, kwForm, user.id)
    if (error) showToast(error, 'error')
    else {
      showToast('Zapisano komentarze KW', 'success')
      const res = await fetch(`/api/properties/${currentPropertyId}`)
      if (res.ok) setProperty(await res.json())
    }
    setSavingKw(false)
  }

  async function handleAddNegNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNegNote.trim()) return
    const res = await fetch(`/api/properties/${propertyId}/negotiation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNegNote.trim() }),
    })
    if (res.ok) { setNewNegNote(''); fetchNegotiation() }
  }

  async function handleDeleteNegNote(noteId: string) {
    await fetch(`/api/properties/${propertyId}/negotiation/${noteId}`, { method: 'DELETE' })
    setNegNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function linkInvestor(kontaktId: string) {
    const res = await fetch(`/api/properties/${propertyId}/investors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kontaktId }),
    })
    if (res.ok) { setInvestorSearch(''); fetchInvestors() }
  }

  async function handleAddNewInvestor(e: React.FormEvent) {
    e.preventDefault()
    if (!newInvestorName.trim()) return
    const res = await fetch('/api/kontakty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typ: 'inwestor', nazwa: newInvestorName.trim(), telefon: newInvestorPhone || null }),
    })
    if (res.ok) {
      const kontakt = await res.json()
      await linkInvestor(kontakt.id)
      setNewInvestorName(''); setNewInvestorPhone(''); setShowNewInvestor(false)
    }
  }

  async function handleInvestorStatus(investorId: string, status: InvestorPropertyStatus) {
    const res = await fetch(`/api/properties/${propertyId}/investors/${investorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setInvestors(prev => prev.map(i => i.id === investorId ? { ...i, status } : i))
  }

  async function handleInvestorOffer(investorId: string, amount: number | null) {
    const res = await fetch(`/api/properties/${propertyId}/investors/${investorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_amount: amount }),
    })
    if (res.ok) setInvestors(prev => prev.map(i => i.id === investorId ? { ...i, offer_amount: amount } : i))
  }

  async function handleRemoveInvestor(investorId: string) {
    await fetch(`/api/properties/${propertyId}/investors/${investorId}`, { method: 'DELETE' })
    setInvestors(prev => prev.filter(i => i.id !== investorId))
  }

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/properties/${propertyId}`)
      if (!res.ok) { router.push('/nieruchomosci'); return }
      const p: Property = await res.json()
      setProperty(p)
      setKwForm({
        kw_dzial1_komentarz: p.kw_dzial1_komentarz || '',
        kw_dzial2_komentarz: p.kw_dzial2_komentarz || '',
        kw_dzial3_komentarz: p.kw_dzial3_komentarz || '',
        kw_dzial4_komentarz: p.kw_dzial4_komentarz || '',
      })
      setLoadingProp(false)
    }
    load()
  }, [propertyId, router])

  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then(data => setProfiles(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  async function handleToggleTask(task: Task) {
    if (!user) return
    const { error } = await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }, user.id)
    if (error) showToast(error, 'error')
  }

  if (loadingProp) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!property || !propertyId) return null
  const currentPropertyId = propertyId

  async function handleEdit(data: Partial<Property>) {
    if (!user) return
    const { error } = await updateProperty(currentPropertyId, data, user.id)
    if (error) { showToast(error, 'error'); return }
    showToast('Zaktualizowano', 'success')
    setShowEditModal(false)
    const res = await fetch(`/api/properties/${currentPropertyId}`)
    if (res.ok) setProperty(await res.json())
  }

  async function handleDelete() {
    const { error } = await deleteProperty(currentPropertyId)
    if (error) { showToast(error, 'error'); return }
    showToast('Usunięto', 'success')
    router.push('/nieruchomosci')
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim() || !user) return
    await createTask({ title: newTaskTitle.trim(), property_id: currentPropertyId, status: 'todo', priority: 'medium' }, user.id)
    setNewTaskTitle('')
  }

  const stageTemplates = property ? (STAGE_TASK_TEMPLATES[property.status_dluznika] ?? []) : []

  async function applyTemplates() {
    if (!user || selectedTemplates.length === 0) return
    await Promise.all(
      selectedTemplates.map(title =>
        createTask({ title, property_id: currentPropertyId, status: 'todo', priority: 'medium' }, user.id)
      )
    )
    setShowTemplates(false)
    setSelectedTemplates([])
  }

  async function confirmStatusChange(comment: string) {
    if (!statusChange || !user || !property) return
    const { error } = await updateProperty(currentPropertyId, {
      [statusChange.field]: statusChange.value,
      // @ts-expect-error statusComment is stripped server-side, not part of Property
      statusComment: comment,
    }, user.id)
    if (error) { showToast(error, 'error'); return }
    showToast('Status zaktualizowany', 'success')
    setStatusChange(null)
    const res = await fetch(`/api/properties/${currentPropertyId}`)
    if (res.ok) setProperty(await res.json())
  }

  const zadluzeniaTotal = sumLineItems(property.zadluzenia)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/nieruchomosci" className="flex items-center gap-2 text-limona-text-muted hover:text-limona-lime text-sm mb-3 transition-colors">
            <ArrowLeft size={16} />
            Powrót do listy
          </Link>
          <h1 className="limona-heading text-2xl lg:text-3xl">{formatPropertyAddress(property)}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge value={property.status_dluznika} />
            <Badge value={property.status_inwestora} />
            {property.deal_type && (
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded',
                property.deal_type === 'zadluzony_ponizej' ? 'bg-limona-blue/15 text-limona-blue' : 'bg-limona-yellow/15 text-limona-yellow'
              )}>
                {DEAL_TYPE_LABELS[property.deal_type as DealType]}
              </span>
            )}
            {property.property_type && (
              <span className="text-xs text-limona-text-muted capitalize">{property.property_type}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowEditModal(true)} className="limona-btn-outline flex items-center gap-2">
            <Edit size={14} />
            Edytuj
          </button>
          {(canAssign || property.assigned_to === user?.id || property.created_by === user?.id) && (
            <button
              onClick={() => {
                if (confirm(`Na pewno usunąć nieruchomość ${formatPropertyAddress(property)}? Zadania, dokumenty i komentarze przepadną.`)) handleDelete()
              }}
              className="p-2.5 rounded-full border border-limona-border text-limona-text-muted hover:border-limona-red hover:text-limona-red transition-colors"
              title="Usuń nieruchomość"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">Wartość (I)</p>
          <p className="font-mono font-bold text-limona-white">{formatMoney(property.value_per_sqm)}</p>
        </div>
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">Wartość realna</p>
          <p className="font-mono font-bold text-limona-text-muted">{formatMoney(property.wartosc_realna)}</p>
        </div>
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">Zadłużenie</p>
          <p className="font-mono font-bold text-limona-yellow">{formatMoney(property.total_debt)}</p>
        </div>
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">Metraż</p>
          <p className="font-mono font-bold text-limona-white">{property.area_sqm ? `${property.area_sqm} m²` : '—'}</p>
        </div>
      </div>

      <div className="limona-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {property.phone && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-limona-text-muted" />
            <span className="text-limona-text">{property.phone}</span>
          </div>
        )}
        {property.assignee && (
          <div className="flex items-center gap-2">
            <User size={14} className="text-limona-text-muted" />
            <Avatar name={property.assignee.full_name} size="sm" />
            <span className="text-limona-text">{property.assignee.full_name}</span>
            {property.co_assignees && property.co_assignees.length > 0 && (
              <span className="text-xs text-limona-text-dim">+{property.co_assignees.length}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-limona-text-muted" />
          <span className="text-limona-text-dim">
            {new Date(property.created_at).toLocaleDateString('pl-PL')}
          </span>
        </div>
      </div>

      {/* Extended property info */}
      {(property.owner_name || property.kw_number || property.czynsz_miesieczny || property.zrodlo) && (
        <div className="limona-card p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {property.owner_name && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Właściciel</p>
              <p className="text-limona-text">{property.owner_name}</p>
            </div>
          )}
          {property.zrodlo && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Źródło tematu</p>
              <p className="text-limona-text">{property.zrodlo}</p>
            </div>
          )}
          {property.kw_number && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Numer KW</p>
              <p className="text-limona-text font-mono text-xs">{property.kw_number}</p>
            </div>
          )}
          {property.czynsz_miesieczny && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Czynsz / mies.</p>
              <p className="text-limona-text font-mono">{formatMoney(property.czynsz_miesieczny)}</p>
            </div>
          )}
        </div>
      )}

      {/* Physical info */}
      {(property.uklad || property.pietro != null || property.rok_budowy || property.balkon_metraz || property.strony_swiata || property.wycena_szacunkowa) && (
        <div className="limona-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          {property.uklad && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Układ</p>
              <p className="text-limona-text">{property.uklad}</p>
            </div>
          )}
          {property.pietro != null && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Piętro</p>
              <p className="text-limona-text font-mono">{property.pietro}{property.pietro_z_ilu ? ` / ${property.pietro_z_ilu}` : ''}</p>
            </div>
          )}
          {property.rok_budowy && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Rok budowy</p>
              <p className="text-limona-text font-mono">{property.rok_budowy}</p>
            </div>
          )}
          {property.balkon_metraz && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Balkon/Taras</p>
              <p className="text-limona-text font-mono">{property.balkon_metraz} m²</p>
            </div>
          )}
          {property.strony_swiata && (
            <div className="flex items-start gap-1">
              <Compass size={12} className="text-limona-text-dim mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Strony</p>
                <p className="text-limona-text">{property.strony_swiata}</p>
              </div>
            </div>
          )}
          {property.wycena_szacunkowa && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Wycena szac.</p>
              <p className="text-limona-text font-mono">{formatMoney(property.wycena_szacunkowa)}</p>
            </div>
          )}
        </div>
      )}

      {/* Suma zadłużenia */}
      {property.zadluzenia && property.zadluzenia.length > 0 && (
        <div className="limona-card p-4 text-sm">
          <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-2">Suma zadłużenia</p>
          <div className="space-y-1">
            {property.zadluzenia.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-limona-text-muted">{d.label}</span>
                <span className="font-mono text-limona-text">{formatMoney(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-limona-border mt-2 pt-2 flex items-center justify-between font-bold">
            <span className="text-limona-text">Razem</span>
            <span className="font-mono text-limona-white">{formatMoney(zadluzeniaTotal)}</span>
          </div>
        </div>
      )}

      {property.notes && (() => {
        const isLong = property.notes.length > 300 || property.notes.split('\n').length > 4
        return (
          <div className="limona-card-accent p-4">
            <p className="text-xs text-limona-text-muted uppercase tracking-wider mb-2">Notatki</p>
            <p className={cn('text-limona-text text-sm whitespace-pre-wrap', isLong && !notesExpanded && 'line-clamp-4')}>
              {property.notes}
            </p>
            {isLong && (
              <button
                onClick={() => setNotesExpanded(v => !v)}
                className="mt-2 text-xs text-limona-lime hover:text-limona-lime-hover transition-colors font-medium"
              >
                {notesExpanded ? 'Zwiń ▲' : 'Rozwiń ▼'}
              </button>
            )}
          </div>
        )
      })()}

      <div className="flex gap-1 border-b border-limona-border overflow-x-auto">
        {([
          { key: 'komentarze', label: 'Komentarze' },
          { key: 'tasks', label: `Zadania (${tasks.length})` },
          { key: 'docs', label: `Dokumenty (${documents.length})` },
          { key: 'checklist', label: `Checklista i status (${Object.values(property.checklist || {}).filter(s => s.checked).length}/${CHECKLIST_INFO.length + CHECKLIST_DOCS.length})` },
          { key: 'negocjacja', label: 'Negocjacja' },
          ...(canSeeInvestors(profile?.role) ? [{ key: 'inwestorzy', label: `Inwestorzy (${investors.length || ''})` }] as const : []),
          { key: 'report', label: 'Raport agenta' },
          { key: 'log', label: 'Historia' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.key
                ? 'border-limona-lime text-limona-lime'
                : 'border-transparent text-limona-text-muted hover:text-limona-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              className="limona-input flex-1"
              placeholder="Dodaj zadanie..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
            />
            <button type="submit" className="limona-btn-sm flex items-center gap-1">
              <Plus size={14} />
              Dodaj
            </button>
            {stageTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => { setShowTemplates(true); setSelectedTemplates([...stageTemplates]) }}
                className="limona-btn-outline text-xs flex items-center gap-1 whitespace-nowrap"
              >
                <Layers size={14} />
                Szablony etapu
              </button>
            )}
          </form>

          {/* Stage templates modal */}
          {showTemplates && (
            <div className="limona-card-accent p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">
                  Szablony zadań — {getStatusDluznikaLabel(property.status_dluznika)}
                </p>
                <button onClick={() => setShowTemplates(false)} className="text-limona-text-dim hover:text-limona-text text-xs">✕</button>
              </div>
              <div className="space-y-2">
                {stageTemplates.map(t => (
                  <label key={t} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTemplates.includes(t)}
                      onChange={e => setSelectedTemplates(prev =>
                        e.target.checked ? [...prev, t] : prev.filter(x => x !== t)
                      )}
                      className="w-4 h-4 accent-limona-lime"
                    />
                    <span className="text-sm text-limona-text group-hover:text-limona-white transition-colors">{t}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={applyTemplates} disabled={selectedTemplates.length === 0}
                  className="limona-btn-sm disabled:opacity-40">
                  Utwórz zaznaczone ({selectedTemplates.length})
                </button>
                <button onClick={() => setShowTemplates(false)} className="limona-btn-outline text-xs">Anuluj</button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <p className="text-center text-limona-text-muted py-8">Brak zadań</p>
          ) : (
            tasks.map(task => (
              <div key={task.id}
                onClick={() => setSelectedTask(task)}
                className="limona-card flex items-center gap-3 p-3 cursor-pointer hover:border-limona-lime/40 transition-colors"
              >
                <button
                  onClick={e => { e.stopPropagation(); handleToggleTask(task) }}
                  className={cn('flex-shrink-0 transition-colors', task.status === 'done' ? 'text-limona-green' : 'text-limona-text-dim hover:text-limona-lime')}
                >
                  {task.status === 'done' ? <CheckCircle size={18} /> : <Circle size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', task.status === 'done' ? 'line-through text-limona-text-muted' : 'text-limona-text')}>
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className="text-xs text-limona-text-dim mt-0.5">
                      Termin: {new Date(task.due_date).toLocaleDateString('pl-PL')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={task.priority} />
                  <button
                    onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                    className="p-1 text-limona-text-dim hover:text-limona-red transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="space-y-4">
          {/* Komentarze do działów KW */}
          <div className="limona-card p-4 space-y-3">
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">Komentarze do działów KW</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KW_DZIALY.map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-limona-text-dim uppercase tracking-wider block mb-1">{label}</label>
                  <textarea
                    className="limona-input min-h-[60px] resize-y text-sm w-full"
                    value={kwForm[key] ?? ''}
                    onChange={e => setKwForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button onClick={handleSaveKw} disabled={savingKw} className="limona-btn-sm flex items-center gap-1.5 disabled:opacity-50">
              <Save size={12} /> {savingKw ? 'Zapisywanie...' : 'Zapisz komentarze KW'}
            </button>
          </div>

          {/* PDF / Cloud storage guide */}
          <div className="limona-card p-4 border-l-[3px] border-l-limona-blue text-sm">
            <p className="text-xs font-bold text-limona-blue uppercase tracking-wider mb-2">Pliki PDF — Google Drive</p>
            <p className="text-limona-text-muted text-xs leading-relaxed">
              Wgraj PDF księgi wieczystej lub inne dokumenty na <strong className="text-limona-white">Dysk Google</strong> i wklej udostępniony link poniżej.
              Udostępnianie: kliknij prawym na plik → Udostępnij → Kopiuj link (dostęp: każdy z linkiem).
            </p>
          </div>
          <form onSubmit={handleAddDoc} className="limona-card-accent p-4 space-y-3">
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">Dodaj dokument (link Google Drive)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="limona-input"
                placeholder="Nazwa dokumentu"
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                required
              />
              <input
                className="limona-input"
                placeholder="Link (Google Drive / URL)"
                value={newDocUrl}
                onChange={e => setNewDocUrl(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                className="limona-select flex-1"
                value={newDocType}
                onChange={e => setNewDocType(e.target.value)}
              >
                <option value="">Typ dokumentu (opcjonalnie)</option>
                <option value="kw">📄 Odpis z KW (PDF)</option>
                <option value="akt_wlasnosci">Akt własności</option>
                <option value="zaswiadczenie">Zaświadczenie</option>
                <option value="umowa">Umowa</option>
                <option value="operat">Wycena szacunkowa</option>
                <option value="zdjecia">Zdjęcia</option>
                <option value="inne">Inne</option>
              </select>
              <button type="submit" disabled={addingDoc} className="limona-btn-sm flex items-center gap-1 whitespace-nowrap">
                <Plus size={14} /> Dodaj
              </button>
            </div>
          </form>

          {docsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} className="text-limona-text-dim mx-auto mb-3" />
              <p className="text-limona-text-muted">Brak dokumentów</p>
              <p className="text-xs text-limona-text-dim mt-1">Dodaj link do dokumentu powyżej</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="limona-card flex items-center gap-3 p-3">
                  <FileText size={16} className="text-limona-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-limona-text font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.file_type && (
                        <span className="text-[10px] uppercase tracking-wider text-limona-text-dim border border-limona-border rounded px-1">{doc.file_type}</span>
                      )}
                      {doc.uploader && (
                        <span className="text-[10px] text-limona-text-dim">{doc.uploader.full_name}</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-limona-lime hover:text-limona-lime-hover transition-colors flex-shrink-0"
                  >
                    <ExternalLink size={14} />
                    Otwórz
                  </a>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {/* Status dłużnika / inwestora — łatwo edytowalne */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Status dłużnika</label>
              <select
                className="limona-select"
                value={property.status_dluznika}
                onChange={e => {
                  const value = e.target.value
                  if (value === property.status_dluznika) return
                  setStatusChange({ field: 'status_dluznika', value, label: STATUS_DLUZNIKA_LABELS[value as StatusDluznika] })
                }}
              >
                {STATUS_DLUZNIKA_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_DLUZNIKA_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="limona-label block mb-2">Status inwestora</label>
              <select
                className="limona-select"
                value={property.status_inwestora}
                onChange={e => {
                  const value = e.target.value
                  if (value === property.status_inwestora) return
                  setStatusChange({ field: 'status_inwestora', value, label: STATUS_INWESTORA_LABELS[value as StatusInwestora] })
                }}
              >
                {STATUS_INWESTORA_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_INWESTORA_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
              <Building2 size={14} />
              Zbieranie informacji ({CHECKLIST_INFO.filter(i => property.checklist?.[i]?.checked).length}/{CHECKLIST_INFO.length})
            </p>
            <div className="space-y-2">
              {CHECKLIST_INFO.map(item => {
                const state = property.checklist?.[item]
                const meta = formatChecklistMeta(state)
                return (
                  <button
                    key={item}
                    onClick={() => toggleCheck(item)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded text-left transition-colors border',
                      state?.checked
                        ? 'border-limona-green/30 bg-limona-green/5'
                        : 'border-limona-border hover:border-limona-border/60 hover:bg-limona-surface-2'
                    )}
                  >
                    {state?.checked
                      ? <CheckSquare size={16} className="text-limona-green flex-shrink-0" />
                      : <Square size={16} className="text-limona-text-dim flex-shrink-0" />
                    }
                    <span className="flex-1">
                      <span className={cn('block text-sm', state?.checked ? 'text-limona-text-muted line-through' : 'text-limona-text')}>
                        {item}
                      </span>
                      {meta && <span className="block text-xs text-limona-text-dim mt-0.5">✓ {meta}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
              <FileText size={14} />
              Dokumenty do sprzedaży ({CHECKLIST_DOCS.filter(i => property.checklist?.[i]?.checked).length}/{CHECKLIST_DOCS.length})
            </p>
            <div className="space-y-2">
              {CHECKLIST_DOCS.map(item => {
                const state = property.checklist?.[item]
                const meta = formatChecklistMeta(state)
                return (
                  <button
                    key={item}
                    onClick={() => toggleCheck(item)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded text-left transition-colors border',
                      state?.checked
                        ? 'border-limona-green/30 bg-limona-green/5'
                        : 'border-limona-border hover:border-limona-border/60 hover:bg-limona-surface-2'
                    )}
                  >
                    {state?.checked
                      ? <CheckSquare size={16} className="text-limona-green flex-shrink-0" />
                      : <Square size={16} className="text-limona-text-dim flex-shrink-0" />
                    }
                    <span className="flex-1">
                      <span className={cn('block text-sm', state?.checked ? 'text-limona-text-muted line-through' : 'text-limona-text')}>
                        {item}
                      </span>
                      {meta && <span className="block text-xs text-limona-text-dim mt-0.5">✓ {meta}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <button
            onClick={async () => {
              if (!user || !propertyId) return
              if (!confirm('Zresetować wszystkie punkty checklisty?')) return
              setProperty(prev => prev ? { ...prev, checklist: {} } : prev)
              const { error } = await updateProperty(propertyId, { checklist: {} }, user.id)
              if (error) showToast(error, 'error')
            }}
            className="text-xs text-limona-text-dim hover:text-limona-red transition-colors"
          >
            Resetuj checklistę
          </button>
        </div>
      )}

      {activeTab === 'komentarze' && propertyId && user && (
        <PropertyComments propertyId={propertyId} userId={user.id} isAdmin={profile?.role === 'admin'} />
      )}

      {activeTab === 'negocjacja' && (
        <div className="space-y-4">
          <form onSubmit={handleAddNegNote} className="limona-card-accent p-4 space-y-3">
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">Nowa notatka negocjacyjna</p>
            <textarea
              className="limona-input w-full min-h-[70px] resize-y text-sm"
              placeholder="Przebieg negocjacji, ustalenia, kontrpropozycje..."
              value={newNegNote}
              onChange={e => setNewNegNote(e.target.value)}
            />
            <button type="submit" disabled={!newNegNote.trim()} className="limona-btn-sm disabled:opacity-40">Dodaj notatkę</button>
          </form>

          {negNotes.length > 1 && (
            <div className="flex justify-end">
              <SortToggle dir={negSortDir} onToggle={() => setNegSortDir(d => d === 'desc' ? 'asc' : 'desc')} />
            </div>
          )}

          {negLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : negNotes.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={32} className="text-limona-text-dim mx-auto mb-3" />
              <p className="text-limona-text-muted">Brak notatek negocjacyjnych</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortByCreatedAt(negNotes, negSortDir).map(note => (
                <div key={note.id} className="limona-card p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-limona-text whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-limona-text-dim mt-1">
                      {note.user?.full_name || 'Użytkownik'} · {new Date(note.created_at).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteNegNote(note.id)} className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inwestorzy' && (
        <div className="space-y-4">
          <div className="limona-card-accent p-4 space-y-3">
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold">Dodaj inwestora</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <input
                  list="investor-options"
                  className="limona-input w-full"
                  placeholder="Wyszukaj istniejącego inwestora..."
                  value={investorSearch}
                  onChange={e => {
                    setInvestorSearch(e.target.value)
                    const match = investorKontakty.find(k => k.nazwa === e.target.value)
                    if (match) linkInvestor(match.id)
                  }}
                />
                <datalist id="investor-options">
                  {investorKontakty
                    .filter(k => !investors.some(i => i.kontakt_id === k.id))
                    .map(k => <option key={k.id} value={k.nazwa} />)}
                </datalist>
              </div>
              <button type="button" onClick={() => setShowNewInvestor(v => !v)} className="limona-btn-outline text-xs flex items-center gap-1.5 whitespace-nowrap">
                <Users size={12} /> Nowy inwestor
              </button>
            </div>
            {showNewInvestor && (
              <form onSubmit={handleAddNewInvestor} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-limona-border">
                <input className="limona-input flex-1" placeholder="Imię i nazwisko / nazwa" value={newInvestorName} onChange={e => setNewInvestorName(e.target.value)} required />
                <input className="limona-input flex-1" placeholder="Telefon (opcjonalnie)" value={newInvestorPhone} onChange={e => setNewInvestorPhone(e.target.value)} />
                <button type="submit" className="limona-btn-sm whitespace-nowrap">Dodaj i przypisz</button>
              </form>
            )}
          </div>

          {investorsLoading ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : investors.length === 0 ? (
            <div className="text-center py-12">
              <Users size={32} className="text-limona-text-dim mx-auto mb-3" />
              <p className="text-limona-text-muted">Brak inwestorów przypisanych do tej nieruchomości</p>
            </div>
          ) : (
            <div className="space-y-2">
              {investors.map(inv => (
                <InvestorOfferCard
                  key={inv.id}
                  propertyId={propertyId!}
                  investor={inv}
                  onStatusChange={handleInvestorStatus}
                  onRemove={handleRemoveInvestor}
                  onOfferChange={handleInvestorOffer}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <AgentReport property={property} />
      )}

      {activeTab === 'log' && (
        <div className="space-y-2">
          {logsLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)
          ) : logs.length === 0 ? (
            <p className="text-center text-limona-text-muted py-8">Brak historii</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 py-3 border-b border-limona-border/50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-limona-lime/10 flex items-center justify-center flex-shrink-0">
                  <Clock size={14} className="text-limona-lime" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-limona-text">{actionLabel(log.action)}</p>
                  {log.user && (
                    <p className="text-xs text-limona-text-dim mt-0.5">{log.user.full_name}</p>
                  )}
                </div>
                <span className="text-xs text-limona-text-dim flex-shrink-0">
                  {new Date(log.created_at).toLocaleDateString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edytuj nieruchomość" size="xl">
        <PropertyForm
          initial={property}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          submitLabel="Zapisz zmiany"
        />
      </Modal>

      <StatusChangeCommentModal
        isOpen={!!statusChange}
        onClose={() => setStatusChange(null)}
        onConfirm={confirmStatusChange}
        newStatusLabel={statusChange?.label || ''}
        entityLabel="nieruchomości"
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (id, updates) => user ? updateTask(id, updates, user.id) : { error: 'No user' }}
          onDelete={async (id, scope) => deleteTask(id, scope)}
          userId={user?.id || ''}
          userName={profile?.full_name || ''}
          isAdmin={profile?.role === 'admin'}
          canAssign={canAssign}
          profiles={profiles}
          tasks={tasks}
        />
      )}
    </div>
  )
}
