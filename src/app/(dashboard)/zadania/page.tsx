'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, Calendar, Link as LinkIcon, Trash2, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, Profile } from '@/types/database'

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
  status: TaskStatus
  assigned_to: string
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  status: 'todo',
  assigned_to: '',
}

export default function ZadaniaPage() {
  const { user, profile } = useAuth()
  const { visibleIds } = useVisibleUserIds(user?.id, profile?.role)
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks(undefined, visibleIds)
  const { showToast } = useToast()

  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStatus, setAddStatus] = useState<TaskStatus>('todo')
  const [form, setForm] = useState<TaskFormData>({ ...EMPTY_FORM })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])

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

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.title.trim()) return

    const { error } = await createTask({
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: addStatus,
      assigned_to: form.assigned_to || null,
    }, user.id)

    if (error) { showToast(error, 'error'); return }
    showToast('Zadanie dodane', 'success')
    setShowAddModal(false)
    setForm({ ...EMPTY_FORM })
  }

  function openAdd(status: TaskStatus) {
    setAddStatus(status)
    setForm({ ...EMPTY_FORM, status })
    setShowAddModal(true)
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (!user) return
    await updateTask(task.id, { status }, user.id)
  }

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    if (!user) return { error: 'No user' }
    return await updateTask(id, updates, user.id)
  }

  async function handleDeleteTask(id: string) {
    return await deleteTask(id)
  }

  function isOverdue(task: Task): boolean {
    if (!task.due_date || task.status === 'done') return false
    return new Date(task.due_date) < new Date()
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
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${view === v ? 'bg-limona-lime text-black' : 'text-limona-text-muted hover:text-limona-white'}`}>
                {v === 'kanban' ? 'Kanban' : 'Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => openAdd('todo')} className="limona-btn-sm flex items-center gap-2">
            <Plus size={14} />
            Dodaj
          </button>
        </div>
      </div>

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
              {tasks.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-limona-text-muted py-12">Brak zadań</td></tr>
              ) : (
                tasks.map(task => (
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
                          {task.property.location}
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
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Dodaj zadanie" size="md">
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
              <input type="date" className="limona-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="limona-label block mb-2">Przypisz do</label>
            <select className="limona-select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Nieprzypisane</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
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
          profiles={profiles}
          tasks={tasks}
        />
      )}
    </div>
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

      {task.property && (
        <div className="flex items-center gap-1 text-[10px] text-limona-blue truncate">
          <LinkIcon size={9} />
          {task.property.location}
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
