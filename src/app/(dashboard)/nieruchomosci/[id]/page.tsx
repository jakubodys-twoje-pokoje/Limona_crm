'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Clock, User, Phone, Plus, CheckCircle, Circle, Trash2 } from 'lucide-react'
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
import type { Property, Task } from '@/types/database'
import type { Calc1Input, Calc2Input } from '@/lib/calculator'

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
  const [activeTab, setActiveTab] = useState<'calc' | 'tasks' | 'log'>('calc')
  const [showEditModal, setShowEditModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

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

      if (p.debt_type === 'above_value') {
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

  async function handleEdit(data: Partial<Property>) {
    if (!user) return
    const { error } = await updateProperty(propertyId, data, user.id)
    if (error) { showToast(error, 'error'); return }
    showToast('Zaktualizowano', 'success')
    setShowEditModal(false)
    const res = await fetch(`/api/properties/${propertyId}`)
    if (res.ok) setProperty(await res.json())
  }

  async function handleDelete() {
    const { error } = await deleteProperty(propertyId)
    if (error) { showToast(error, 'error'); return }
    showToast('Usunięto', 'success')
    router.push('/nieruchomosci')
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim() || !user) return
    await createTask({ title: newTaskTitle.trim(), property_id: propertyId, status: 'todo', priority: 'medium' }, user.id)
    setNewTaskTitle('')
  }

  async function handleToggleTask(task: Task) {
    if (!user) return
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }, user.id)
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

  if (!property) return null

  const isAbove = property.debt_type === 'above_value'

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
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-limona-text-muted" />
          <span className="text-limona-text-dim">
            {new Date(property.created_at).toLocaleDateString('pl-PL')}
          </span>
        </div>
      </div>

      {property.notes && (
        <div className="limona-card-accent p-4">
          <p className="text-xs text-limona-text-muted uppercase tracking-wider mb-2">Notatki</p>
          <p className="text-limona-text text-sm whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-limona-border">
        {([
          { key: 'calc', label: 'Kalkulator' },
          { key: 'tasks', label: `Zadania (${tasks.length})` },
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
          </form>

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
