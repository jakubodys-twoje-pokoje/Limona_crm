'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Clock, User, Phone, Plus, CheckCircle, Circle, Trash2, Tag, Home, BookOpen, Layers, FileText, ExternalLink, Square, CheckSquare, Building2, Compass, BarChart2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProperties } from '@/hooks/useProperties'
import { useTasks } from '@/hooks/useTasks'
import { useActivityLog } from '@/hooks/useActivityLog'
import { useToast } from '@/components/ui/Toast'
import { Calculator1 } from '@/components/calculator/Calculator1'
import { Calculator2 } from '@/components/calculator/Calculator2'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatMoney, cn } from '@/lib/utils'
import type { Property, Task, Document } from '@/types/database'
import type { Calc1Input, Calc2Input } from '@/lib/calculator'
import { STAGE_TASK_TEMPLATES, getStageLabel, DEAL_TYPE_LABELS } from '@/lib/stages'
import type { DealType } from '@/types/database'
import { AgentReport } from '@/components/properties/AgentReport'

const CHECKLIST_INFO = [
  'Zweryfikowana KW', 'Kontakt z właścicielem', 'Rzut planu / metraż',
  'Rok budowy potwierdzony', 'Piętro i układ', 'Stan techniczny oceniony',
  'Zadłużenie potwierdzone', 'Czynsz miesięczny ustalony', 'Operat szacunkowy',
  'Zdjęcia wykonane',
]
const CHECKLIST_DOCS = [
  'Akt własności / odpis z KW', 'Zaświadczenie o niezaleganiu w czynszu',
  'Zaświadczenie ze spółdzielni / wspólnoty', 'Zaświadczenie z urzędu skarbowego',
  'Poprzedni akt notarialny', 'Pełnomocnictwo (jeśli dotyczy)',
  'Umowa przedwstępna kupna', 'Umowa przedwstępna sprzedaży',
  'Protokół zdania nieruchomości',
]

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

export default function PropertyDetailPage() {
  const { id } = useParams()
  const propertyId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { user } = useAuth()
  const { updateProperty, deleteProperty } = useProperties()
  const { tasks, createTask, updateTask, deleteTask } = useTasks(propertyId)
  const { logs, loading: logsLoading } = useActivityLog(propertyId)
  const { showToast } = useToast()

  const [property, setProperty] = useState<Property | null>(null)
  const [loadingProp, setLoadingProp] = useState(true)
  const [activeTab, setActiveTab] = useState<'calc' | 'tasks' | 'docs' | 'checklist' | 'log' | 'report'>('tasks')
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

  // Checklist state (stored in localStorage per property)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!propertyId) return
    try {
      const saved = JSON.parse(localStorage.getItem(`limona-checklist-${propertyId}`) || '[]') as string[]
      setCheckedItems(new Set(saved))
    } catch { /* ignore */ }
  }, [propertyId])

  function toggleCheck(item: string) {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      localStorage.setItem(`limona-checklist-${propertyId}`, JSON.stringify(Array.from(next)))
      return next
    })
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
        stage: property?.status || null,
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

  const [calc1Input, setCalc1Input] = useState<Calc1Input>({
    valuePerSqm: 0, totalDebt: 0, commissionPct: 0, notaryFee: 1000, manualOffer: null,
  })
  const [calc2Input, setCalc2Input] = useState<Calc2Input>({
    valuePerSqm: 0, totalDebt: 0, creditor1: 0, creditor2: 0, creditor3: 0,
    ownerCoefficient: 0.025, commissionPct: 0, notaryFee: 1000, manualOffer: null,
  })

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/properties/${propertyId}`)
      if (!res.ok) { router.push('/nieruchomosci'); return }
      const p: Property = await res.json()
      setProperty(p)

      if (p.deal_type === 'zadluzony_powyzej' || p.debt_type === 'above_value') {
        setCalc2Input({
          valuePerSqm: p.value_per_sqm || 0,
          totalDebt: p.total_debt || 0,
          creditor1: p.creditor1_amount || 0,
          creditor2: p.creditor2_amount || 0,
          creditor3: p.creditor3_amount || 0,
          ownerCoefficient: p.owner_coefficient || 0.025,
          commissionPct: (p.commission_pct || 0) / 100,
          notaryFee: p.notary_fee || 1000,
          manualOffer: p.manual_offer,
        })
      } else {
        setCalc1Input({
          valuePerSqm: p.value_per_sqm || 0,
          totalDebt: p.total_debt || 0,
          commissionPct: (p.commission_pct || 0) / 100,
          notaryFee: p.notary_fee || 1000,
          manualOffer: p.manual_offer,
        })
      }
      setLoadingProp(false)
    }
    load()
  }, [propertyId, router])

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

  const isAbove = property.deal_type === 'zadluzony_powyzej' || property.debt_type === 'above_value'
  const stageTemplates = STAGE_TASK_TEMPLATES[property.status] ?? []

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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/nieruchomosci" className="flex items-center gap-2 text-limona-text-muted hover:text-limona-lime text-sm mb-3 transition-colors">
            <ArrowLeft size={16} />
            Powrót do listy
          </Link>
          <h1 className="limona-heading text-2xl lg:text-3xl">{property.location}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge value={property.status} />
            {property.deal_type && (
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded',
                property.deal_type === 'zadluzony_ponizej' ? 'bg-limona-blue/15 text-limona-blue' :
                property.deal_type === 'zadluzony_powyzej' ? 'bg-limona-yellow/15 text-limona-yellow' :
                'bg-limona-lime/15 text-limona-lime'
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
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">Wartość (I)</p>
          <p className="font-mono font-bold text-limona-white">{formatMoney(property.value_per_sqm)}</p>
        </div>
        <div className="limona-card p-4">
          <p className="text-xs text-limona-text-muted mb-1">RW (J)</p>
          <p className="font-mono font-bold text-limona-text-muted">{formatMoney(property.rw)}</p>
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
            {property.contact_type && (
              <span className="text-xs text-limona-text-dim">({property.contact_type})</span>
            )}
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
      {(property.owner_name || property.kw_number || property.source || property.czynsz_miesieczny) && (
        <div className="limona-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {property.owner_name && (
            <div className="flex items-start gap-2">
              <Home size={14} className="text-limona-text-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Właściciel</p>
                <p className="text-limona-text">{property.owner_name}</p>
              </div>
            </div>
          )}
          {property.kw_number && (
            <div className="flex items-start gap-2">
              <BookOpen size={14} className="text-limona-text-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Numer KW</p>
                <p className="text-limona-text font-mono text-xs">{property.kw_number}</p>
                {property.kw_opis && <p className="text-limona-text-dim text-xs mt-0.5">{property.kw_opis}</p>}
              </div>
            </div>
          )}
          {property.source && (
            <div className="flex items-start gap-2">
              <Tag size={14} className="text-limona-text-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Źródło</p>
                <p className="text-limona-text">{property.source}</p>
              </div>
            </div>
          )}
          {property.czynsz_miesieczny && (
            <div className="flex items-start gap-2">
              <Layers size={14} className="text-limona-text-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">Czynsz / mies.</p>
                <p className="text-limona-text font-mono">{formatMoney(property.czynsz_miesieczny)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Physical info */}
      {(property.uklad || property.pietro != null || property.rok_budowy || property.balkon_metraz || property.strony_swiata || property.operat_szacunkowy) && (
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
              <p className="text-limona-text font-mono">{property.pietro}</p>
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
          {property.operat_szacunkowy && (
            <div>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider mb-0.5">Operat szac.</p>
              <p className="text-limona-text font-mono">{formatMoney(property.operat_szacunkowy)}</p>
            </div>
          )}
        </div>
      )}

      {property.notes && (
        <div className="limona-card-accent p-4">
          <p className="text-xs text-limona-text-muted uppercase tracking-wider mb-2">Notatki</p>
          <p className="text-limona-text text-sm whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-limona-border overflow-x-auto">
        {([
          { key: 'tasks', label: `Zadania (${tasks.length})` },
          { key: 'docs', label: `Dokumenty (${documents.length})` },
          { key: 'checklist', label: `Checklista (${checkedItems.size}/${CHECKLIST_INFO.length + CHECKLIST_DOCS.length})` },
          { key: 'report', label: 'Raport agenta' },
          { key: 'log', label: 'Historia' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-limona-lime text-limona-lime'
                : 'border-transparent text-limona-text-muted hover:text-limona-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'calc' && (
        <div className="limona-card p-4 lg:p-6">
          {isAbove ? (
            <Calculator2
              input={calc2Input}
              onChange={(key, val) => setCalc2Input(prev => ({ ...prev, [key]: val ?? 0 }))}
              showInputs
            />
          ) : (
            <Calculator1
              input={calc1Input}
              onChange={(key, val) => setCalc1Input(prev => ({ ...prev, [key]: val ?? 0 }))}
              showInputs
            />
          )}
        </div>
      )}

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
                  Szablony zadań — {getStageLabel(property.status)}
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
              <div key={task.id} className="limona-card flex items-center gap-3 p-3">
                <button
                  onClick={() => handleToggleTask(task)}
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
                    onClick={() => deleteTask(task.id)}
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
                <option value="operat">Operat szacunkowy</option>
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
                      {doc.stage && (
                        <span className="text-[10px] text-limona-text-dim">etap: {doc.stage}</span>
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
          <div>
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
              <Building2 size={14} />
              Zbieranie informacji ({CHECKLIST_INFO.filter(i => checkedItems.has(i)).length}/{CHECKLIST_INFO.length})
            </p>
            <div className="space-y-2">
              {CHECKLIST_INFO.map(item => (
                <button
                  key={item}
                  onClick={() => toggleCheck(item)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded text-left transition-colors border',
                    checkedItems.has(item)
                      ? 'border-limona-green/30 bg-limona-green/5'
                      : 'border-limona-border hover:border-limona-border/60 hover:bg-limona-surface-2'
                  )}
                >
                  {checkedItems.has(item)
                    ? <CheckSquare size={16} className="text-limona-green flex-shrink-0" />
                    : <Square size={16} className="text-limona-text-dim flex-shrink-0" />
                  }
                  <span className={cn('text-sm', checkedItems.has(item) ? 'text-limona-text-muted line-through' : 'text-limona-text')}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-limona-lime uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
              <FileText size={14} />
              Dokumenty do sprzedaży ({CHECKLIST_DOCS.filter(i => checkedItems.has(i)).length}/{CHECKLIST_DOCS.length})
            </p>
            <div className="space-y-2">
              {CHECKLIST_DOCS.map(item => (
                <button
                  key={item}
                  onClick={() => toggleCheck(item)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded text-left transition-colors border',
                    checkedItems.has(item)
                      ? 'border-limona-green/30 bg-limona-green/5'
                      : 'border-limona-border hover:border-limona-border/60 hover:bg-limona-surface-2'
                  )}
                >
                  {checkedItems.has(item)
                    ? <CheckSquare size={16} className="text-limona-green flex-shrink-0" />
                    : <Square size={16} className="text-limona-text-dim flex-shrink-0" />
                  }
                  <span className={cn('text-sm', checkedItems.has(item) ? 'text-limona-text-muted line-through' : 'text-limona-text')}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (!confirm('Zresetować wszystkie punkty checklisty?')) return
              setCheckedItems(new Set())
              localStorage.removeItem(`limona-checklist-${propertyId}`)
            }}
            className="text-xs text-limona-text-dim hover:text-limona-red transition-colors"
          >
            Resetuj checklistę
          </button>
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
    </div>
  )
}
