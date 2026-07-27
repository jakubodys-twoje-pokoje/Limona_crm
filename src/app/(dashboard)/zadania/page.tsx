'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Calendar, CalendarDays, Link as LinkIcon, Trash2, CheckCircle, Clock, AlertCircle, XCircle, X } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useBoards } from '@/hooks/useBoards'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { BoardView, BOARD_COLORS } from '@/components/tasks/BoardView'
import { TASK_TYPE_LABELS, CONTACT_CATEGORY_LABELS } from '@/lib/reports'
import { canSeeAllTeams } from '@/lib/roles'
import { cn, formatPropertyAddress, isOverdueDate } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, TaskType, ContactCategory, Profile, RecurrenceFreq, KontaktTyp } from '@/types/database'
import { KONTAKT_TYP_LABELS } from '@/types/database'
import { EntityPicker, type EntityPickerItem } from '@/components/shared/EntityPicker'

const columns: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: 'todo', label: 'Do zrobienia', icon: <Circle16 />, color: 'border-t-gray-500' },
  { status: 'in_progress', label: 'W trakcie', icon: <Clock size={14} />, color: 'border-t-[#448AFF]' },
  { status: 'done', label: 'Zrobione', icon: <CheckCircle size={14} />, color: 'border-t-[#00E676]' },
  { status: 'blocked', label: 'Zablokowane', icon: <XCircle size={14} />, color: 'border-t-[#FF3D3D]' },
]

function Circle16() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

interface TaskFormData {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
  due_time: string
  status: TaskStatus
  assigned_to: string
  co_assignees: string[]
  task_type: TaskType | ''
  contact_category: ContactCategory | ''
  recurrence_freq: RecurrenceFreq | ''
  recurrence_interval: number
  recurrence_until: string
  property_id: string | null
  kontakt_id: string | null
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  due_time: '',
  status: 'todo',
  assigned_to: '',
  co_assignees: [],
  task_type: '',
  contact_category: '',
  recurrence_freq: '',
  recurrence_interval: 1,
  recurrence_until: '',
  property_id: null,
  kontakt_id: null,
}

const RECURRENCE_FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc',
}

interface NewBoardForm {
  name: string
  color: string
  lists: string[]
}

export default function ZadaniaPage() {
  const { user, profile } = useAuth()
  const canAssign = canSeeAllTeams(profile?.role)
  const { visibleIds, loading: visLoading } = useVisibleUserIds(user?.id, profile?.role)
  const { boards, loading: boardsLoading, createBoard, updateBoard, deleteBoard } = useBoards()

  // selectedBoardId === null means Ogólne (tasks without board_id)
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)

  // For Ogólne mode, pass 'none' so tasks API filters board_id IS NULL
  const boardIdFilter = selectedBoardId === null ? 'none' : selectedBoardId
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks(undefined, visibleIds, boardIdFilter, undefined, !visLoading)
  const { showToast } = useToast()

  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStatus, setAddStatus] = useState<TaskStatus>('todo')
  const [form, setForm] = useState<TaskFormData>({ ...EMPTY_FORM, assigned_to: canAssign ? '' : (user?.id ?? '') })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Listy do powiązania zadania z nieruchomością/kontaktem — ładowane
  // leniwie przy pierwszym otwarciu formularza (prawie 2000 kontaktów)
  const [pickProperties, setPickProperties] = useState<EntityPickerItem[]>([])
  const [pickKontakty, setPickKontakty] = useState<EntityPickerItem[]>([])
  const pickersFetched = useRef(false)
  useEffect(() => {
    if (!showAddModal || pickersFetched.current || visLoading) return
    pickersFetched.current = true
    const visParam = visibleIds?.length ? `?visibleIds=${visibleIds.join(',')}` : ''
    fetch(`/api/properties${visParam}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; adres: string; kod_pocztowy: string | null; miasto: string | null }[]) => {
        setPickProperties(data.map(p => ({ id: p.id, label: formatPropertyAddress(p), sublabel: p.miasto })))
      })
      .catch(() => {})
    fetch(`/api/kontakty${visParam}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; nazwa: string; typ: string; miasto: string | null }[]) => {
        setPickKontakty(data.map(k => ({
          id: k.id,
          label: k.nazwa,
          sublabel: [KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ, k.miasto].filter(Boolean).join(' · '),
        })))
      })
      .catch(() => {})
  }, [showAddModal, visibleIds, visLoading])

  // New board modal state
  const [showNewBoardModal, setShowNewBoardModal] = useState(false)
  const [newBoardForm, setNewBoardForm] = useState<NewBoardForm>({
    name: '',
    color: '#84cc16',
    lists: ['Do zrobienia', 'W toku', 'Gotowe'],
  })

  const profilesFetched = useRef(false)
  useEffect(() => {
    if (profilesFetched.current) return
    profilesFetched.current = true
    fetch('/api/profiles').then(r => r.json()).then(data => setProfiles(data || []))
  }, [])

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks, selectedTask])

  // Jednolite sortowanie zadań (desktop i mobile): najbliższy/zaległy termin
  // u góry, w ramach dnia po godzinie, zadania bez terminu na końcu,
  // remis rozstrzyga nowsze utworzenie.
  const sortedTasks = useMemo(() => {
    const key = (t: Task) => t.due_date ? `${t.due_date} ${t.due_time ?? '99:99'}` : '9999-99-99'
    return [...tasks].sort((a, b) => {
      const ak = key(a), bk = key(b)
      if (ak !== bk) return ak < bk ? -1 : 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [tasks])

  const byStatus = (status: TaskStatus) => sortedTasks.filter(t => t.status === status)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.title.trim()) return

    const { error } = await createTask({
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      due_time: form.due_date ? (form.due_time || null) : null,
      status: addStatus,
      assigned_to: form.assigned_to || null,
      co_assignees: form.co_assignees,
      task_type: form.task_type || null,
      contact_category: form.contact_category || null,
      recurrence_freq: form.due_date ? (form.recurrence_freq || null) : null,
      recurrence_interval: form.recurrence_interval || 1,
      recurrence_until: form.recurrence_until || null,
      property_id: form.property_id,
      kontakt_id: form.kontakt_id,
    }, user.id)

    if (error) { showToast(error, 'error'); return }
    showToast('Zadanie dodane', 'success')
    setShowAddModal(false)
    setForm({ ...EMPTY_FORM, assigned_to: canAssign ? '' : (user?.id ?? '') })
  }

  function openAdd(status: TaskStatus) {
    setAddStatus(status)
    setForm({ ...EMPTY_FORM, status, assigned_to: canAssign ? '' : (user?.id ?? '') })
    setShowAddModal(true)
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (!user) return
    const { error } = await updateTask(task.id, { status }, user.id)
    if (error) {
      showToast(error, 'error')
      if (status === 'done') setSelectedTask(task) // otwórz modal, żeby uzupełnić wynik
    }
  }

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    if (!user) return { error: 'No user' }
    return await updateTask(id, updates, user.id)
  }

  async function handleDeleteTask(id: string, scope?: 'one' | 'following' | 'series') {
    return await deleteTask(id, scope)
  }

  function isOverdue(task: Task): boolean {
    if (!task.due_date || task.status === 'done') return false
    return isOverdueDate(task.due_date)
  }

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault()
    if (!newBoardForm.name.trim()) return
    const { error, data } = await createBoard({
      name: newBoardForm.name.trim(),
      color: newBoardForm.color,
      lists: newBoardForm.lists.filter(l => l.trim()),
    })
    if (error) { showToast(error, 'error'); return }
    setShowNewBoardModal(false)
    setNewBoardForm({ name: '', color: '#84cc16', lists: ['Do zrobienia', 'W toku', 'Gotowe'] })
    if (data) setSelectedBoardId(data.id)
  }

  // Board tabs
  const tabBar = (
    <div className="flex items-center gap-1 border-b border-limona-border mb-4 overflow-x-auto">
      <button
        onClick={() => setSelectedBoardId(null)}
        className={cn(
          'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors whitespace-nowrap',
          selectedBoardId === null
            ? 'border-limona-lime text-limona-lime'
            : 'border-transparent text-limona-text-muted hover:text-limona-white'
        )}
      >
        Ogólne
      </button>
      {boards.map(b => (
        <button
          key={b.id}
          onClick={() => setSelectedBoardId(b.id)}
          className={cn(
            'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors whitespace-nowrap',
            selectedBoardId === b.id
              ? 'text-limona-white'
              : 'border-transparent text-limona-text-muted hover:text-limona-white'
          )}
          style={{ borderBottomColor: selectedBoardId === b.id ? b.color : 'transparent' }}
        >
          {b.name}
        </button>
      ))}
      <button
        onClick={() => setShowNewBoardModal(true)}
        className="px-3 py-2.5 text-xs text-limona-text-dim hover:text-limona-lime transition-colors flex items-center gap-1 whitespace-nowrap ml-1"
      >
        <Plus size={12} /> Nowa tablica
      </button>
    </div>
  )

  // If a custom board is selected, show BoardView
  const selectedBoard = boards.find(b => b.id === selectedBoardId)
  if (!boardsLoading && selectedBoard) {
    return (
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="limona-eyebrow">Workflow</span>
            <h1 className="limona-heading text-3xl mt-1">Zadania</h1>
          </div>
        </div>

        {tabBar}

        <BoardView
          board={selectedBoard}
          visibleIds={visibleIds}
          userId={user?.id || ''}
          userName={profile?.full_name || ''}
          isAdmin={profile?.role === 'admin'}
          canAssign={canAssign}
          profiles={profiles}
          allTasks={tasks}
          onBoardUpdate={async (updates) => { await updateBoard(selectedBoard.id, updates) }}
          onBoardDelete={async () => { await deleteBoard(selectedBoard.id); setSelectedBoardId(null) }}
        />

        {/* New Board Modal */}
        <NewBoardModal
          show={showNewBoardModal}
          form={newBoardForm}
          onFormChange={setNewBoardForm}
          onSubmit={handleCreateBoard}
          onClose={() => setShowNewBoardModal(false)}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8" />
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-24" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="limona-eyebrow">Workflow</span>
          <h1 className="limona-heading text-3xl mt-1">Zadania</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-limona-surface rounded">
            {([
              { key: 'kanban', label: 'Kanban' },
              { key: 'list',   label: 'Lista'   },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${view === v.key ? 'bg-limona-lime text-black' : 'text-limona-text-muted hover:text-limona-white'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <Link href="/zadania/kalendarz" className="limona-btn-outline px-4 py-2 text-xs flex items-center gap-2">
            <CalendarDays size={14} />
            Terminarz
          </Link>
          <button onClick={() => openAdd('todo')} className="limona-btn-sm flex items-center gap-2">
            <Plus size={14} />
            Dodaj
          </button>
        </div>
      </div>

      {tabBar}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(col => {
            const colTasks = byStatus(col.status)
            return (
              <div key={col.status} className={`limona-card border-t-2 ${col.color} flex flex-col`}>
                <div className="p-3 border-b border-limona-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-limona-text-muted">{col.icon}</span>
                    <span className="text-xs uppercase tracking-wider font-bold text-limona-text-muted">{col.label}</span>
                    <span className="text-xs bg-limona-border/50 rounded-full px-2 py-0.5 font-mono">{colTasks.length}</span>
                  </div>
                  <button onClick={() => openAdd(col.status)}
                    className="text-limona-text-dim hover:text-limona-lime transition-colors p-1">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdue(task)}
                      onMove={moveTask}
                      onDelete={() => deleteTask(task.id)}
                      onOpen={() => setSelectedTask(task)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-center text-limona-text-dim text-xs py-4">Brak zadań</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="limona-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-limona-border">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Zadanie</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Status</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Priorytet</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Przypisane</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Termin</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-limona-text-muted">Nieruchomość</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-limona-text-muted py-12">Brak zadań</td></tr>
              ) : (
                sortedTasks.map(task => (
                  <tr key={task.id}
                    className="border-b border-limona-border/50 hover:bg-limona-surface-2/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTask(task)}>
                    <td className="py-3 px-4">
                      <p className={cn('font-medium', task.status === 'done' && 'line-through text-limona-text-muted')}>
                        {task.title}
                      </p>
                    </td>
                    <td className="py-3 px-4"><Badge value={task.status} /></td>
                    <td className="py-3 px-4"><Badge value={task.priority} /></td>
                    <td className="py-3 px-4">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size="sm" />
                          <span className="text-xs">{task.assignee.full_name}</span>
                        </div>
                      ) : <span className="text-limona-text-dim text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {task.due_date ? (
                        <span className={cn('text-xs font-mono', isOverdue(task) && 'text-limona-red')}>
                          {new Date(task.due_date).toLocaleDateString('pl-PL')}
                        </span>
                      ) : <span className="text-limona-text-dim">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {task.property ? (
                        <span className="text-xs text-limona-blue flex items-center gap-1">
                          <LinkIcon size={11} />
                          {formatPropertyAddress(task.property)}
                        </span>
                      ) : task.kontakt ? (
                        <span className="text-xs text-limona-lime flex items-center gap-1">
                          <LinkIcon size={11} />
                          {task.kontakt.nazwa}
                        </span>
                      ) : <span className="text-limona-text-dim">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Dodaj zadanie" size="md" confirmClose>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="limona-label block mb-2">Tytuł *</label>
            <input required className="limona-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Opisz zadanie..." autoFocus />
          </div>
          <div>
            <label className="limona-label block mb-2">Opis</label>
            <textarea className="limona-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Szczegóły..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Typ zadania</label>
              <select className="limona-select" value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value as TaskType | '' }))}>
                <option value="">—</option>
                {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map(t => (
                  <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="limona-label block mb-2">Kategoria kontaktu</label>
              <select className="limona-select" value={form.contact_category} onChange={e => setForm(f => ({ ...f, contact_category: e.target.value as ContactCategory | '' }))}>
                <option value="">—</option>
                {(Object.keys(CONTACT_CATEGORY_LABELS) as ContactCategory[]).map(c => (
                  <option key={c} value={c}>{CONTACT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntityPicker
              label="Powiąż z nieruchomością"
              placeholder="Wpisz adres lub miasto..."
              items={pickProperties}
              value={form.property_id}
              onChange={id => setForm(f => ({ ...f, property_id: id }))}
              accentClass="text-limona-blue"
            />
            <EntityPicker
              label="Powiąż z kontaktem"
              placeholder="Wpisz nazwę lub miasto..."
              items={pickKontakty}
              value={form.kontakt_id}
              onChange={id => setForm(f => ({ ...f, kontakt_id: id }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Priorytet</label>
              <select className="limona-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
                <option value="urgent">Pilny</option>
              </select>
            </div>
            <div>
              <label className="limona-label block mb-2">Termin</label>
              <div className="flex gap-2">
                <input type="date" className="limona-input flex-1" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                <input
                  type="time"
                  className="limona-input w-28 disabled:opacity-50"
                  value={form.due_time}
                  disabled={!form.due_date}
                  title={form.due_date ? 'Godzina (opcjonalnie)' : 'Ustaw najpierw datę'}
                  onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="limona-label block mb-2">Powtarzaj (zadanie cykliczne)</label>
              <select
                className="limona-select disabled:opacity-50"
                value={form.recurrence_freq}
                disabled={!form.due_date}
                onChange={e => setForm(f => ({ ...f, recurrence_freq: e.target.value as RecurrenceFreq | '' }))}
              >
                <option value="">Nie powtarzaj</option>
                {(Object.keys(RECURRENCE_FREQ_LABELS) as RecurrenceFreq[]).map(f => (
                  <option key={f} value={f}>{RECURRENCE_FREQ_LABELS[f]}</option>
                ))}
              </select>
              {!form.due_date && (
                <p className="text-[10px] text-limona-text-dim mt-1">Ustaw najpierw termin, aby móc powtarzać zadanie.</p>
              )}
            </div>
            {form.due_date && form.recurrence_freq && (
              <div>
                <label className="limona-label block mb-2">Powtarzaj do (opcjonalnie)</label>
                <input
                  type="date"
                  className="limona-input"
                  value={form.recurrence_until}
                  min={form.due_date}
                  onChange={e => setForm(f => ({ ...f, recurrence_until: e.target.value }))}
                />
              </div>
            )}
          </div>
          {form.recurrence_freq && (
            <p className="text-xs text-limona-text-dim -mt-2">
              Każde wystąpienie to osobne zadanie z własnymi komentarzami i statusem — nie wpływają na siebie nawzajem.
            </p>
          )}
          <div>
            <label className="limona-label block mb-2">Główny wykonawca</label>
            {canAssign ? (
              <select
                className="limona-select"
                value={form.assigned_to}
                onChange={e => {
                  const assigned_to = e.target.value
                  setForm(f => ({ ...f, assigned_to, co_assignees: f.co_assignees.filter(id => id !== assigned_to) }))
                }}
              >
                <option value="">Nieprzypisane</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            ) : (
              <p className="limona-input flex items-center text-limona-text-muted">Ty — zadania zawsze trafiają do twórcy</p>
            )}
          </div>
          <div>
            <label className="limona-label block mb-2">Dodatkowi wykonawcy (CC)</label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {profiles
                .filter(p => p.id !== form.assigned_to)
                .map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-limona-surface-2/50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      className="accent-limona-lime"
                      checked={form.co_assignees.includes(p.id)}
                      onChange={e => setForm(f => ({
                        ...f,
                        co_assignees: e.target.checked
                          ? [...f.co_assignees, p.id]
                          : f.co_assignees.filter(id => id !== p.id),
                      }))}
                    />
                    <span className="text-sm text-limona-text">{p.full_name}</span>
                    <span className="text-xs text-limona-text-dim">{p.role}</span>
                  </label>
                ))}
            </div>
            {form.co_assignees.length > 0 && (
              <p className="text-xs text-limona-text-dim mt-1">
                {form.co_assignees.length} dodatkowych wykonawców
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" className="limona-btn">Dodaj zadanie</button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal (Trello-style) */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          userId={user?.id || ''}
          userName={profile?.full_name || ''}
          isAdmin={profile?.role === 'admin'}
          canAssign={canAssign}
          profiles={profiles}
          tasks={tasks}
        />
      )}

      {/* New Board Modal */}
      <NewBoardModal
        show={showNewBoardModal}
        form={newBoardForm}
        onFormChange={setNewBoardForm}
        onSubmit={handleCreateBoard}
        onClose={() => setShowNewBoardModal(false)}
      />
    </div>
  )
}

/* ─── NewBoardModal ─── */
function NewBoardModal({
  show, form, onFormChange, onSubmit, onClose,
}: {
  show: boolean
  form: { name: string; color: string; lists: string[] }
  onFormChange: (f: { name: string; color: string; lists: string[] }) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  onClose: () => void
}) {
  function updateList(i: number, val: string) {
    const lists = [...form.lists]
    lists[i] = val
    onFormChange({ ...form, lists })
  }

  function removeList(i: number) {
    onFormChange({ ...form, lists: form.lists.filter((_, idx) => idx !== i) })
  }

  function addList() {
    onFormChange({ ...form, lists: [...form.lists, ''] })
  }

  return (
    <Modal isOpen={show} onClose={onClose} title="Nowa tablica" size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="limona-label block mb-2">Nazwa tablicy *</label>
          <input
            required
            autoFocus
            className="limona-input w-full"
            value={form.name}
            onChange={e => onFormChange({ ...form, name: e.target.value })}
            placeholder="np. Sprint Q3, Marketing..."
          />
        </div>
        <div>
          <label className="limona-label block mb-2">Kolor</label>
          <div className="flex gap-2 flex-wrap">
            {BOARD_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onFormChange({ ...form, color: c })}
                className={cn('w-8 h-8 rounded-full border-2 transition-all', form.color === c ? 'border-white scale-110' : 'border-transparent hover:border-white/50')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="limona-label block mb-2">Kolumny startowe</label>
          <div className="space-y-2">
            {form.lists.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="limona-input flex-1 text-sm"
                  value={l}
                  onChange={e => updateList(i, e.target.value)}
                  placeholder={`Kolumna ${i + 1}`}
                />
                <button type="button" onClick={() => removeList(i)} className="p-1 text-limona-text-dim hover:text-limona-red">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addList}
              className="text-xs text-limona-text-dim hover:text-limona-lime flex items-center gap-1 transition-colors">
              <Plus size={12} /> Dodaj kolumnę
            </button>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button type="submit" className="limona-btn" style={{ backgroundColor: form.color }}>
            Utwórz tablicę
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TaskCard({ task, isOverdue, onMove, onDelete, onOpen }: {
  task: Task
  isOverdue: boolean
  onMove: (task: Task, status: TaskStatus) => void
  onDelete: () => void
  onOpen: () => void
}) {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']

  return (
    <div
      className={cn(
        'limona-card p-3 space-y-2 group cursor-pointer hover:border-limona-lime/30 transition-all',
        task.status === 'done' && 'opacity-60'
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-1">
        <p className={cn('text-sm font-medium leading-snug flex-1', task.status === 'done' && 'line-through text-limona-text-muted')}>
          {task.title}
        </p>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-limona-text-dim hover:text-limona-red transition-all flex-shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-limona-text-dim line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge value={task.priority} />
          {task.assignee && (
            <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size="sm" />
          )}
        </div>
        {isOverdue && (
          <span className="flex items-center gap-1 text-[10px] text-limona-red uppercase tracking-wider">
            <AlertCircle size={10} />
            Przeterminowane
          </span>
        )}
        {task.due_date && !isOverdue && (
          <span className="flex items-center gap-1 text-[10px] text-limona-text-dim">
            <Calendar size={10} />
            {new Date(task.due_date).toLocaleDateString('pl-PL')}
          </span>
        )}
      </div>

      {task.property ? (
        <div className="flex items-center gap-1 text-[10px] text-limona-blue truncate">
          <LinkIcon size={9} />
          {formatPropertyAddress(task.property)}
        </div>
      ) : task.kontakt && (
        <div className="flex items-center gap-1 text-[10px] text-limona-lime truncate">
          <LinkIcon size={9} />
          {task.kontakt.nazwa}
        </div>
      )}

      {/* Quick move buttons */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {statuses.filter(s => s !== task.status).map(s => (
          <button key={s} onClick={(e) => { e.stopPropagation(); onMove(task, s) }}
            className="text-[9px] px-2 py-0.5 bg-limona-border/30 hover:bg-limona-lime/20 hover:text-limona-lime rounded-full uppercase tracking-wider transition-colors">
            {s === 'todo' ? 'Todo' : s === 'in_progress' ? 'W trakcie' : s === 'done' ? 'Done' : 'Blocked'}
          </button>
        ))}
      </div>
    </div>
  )
}
