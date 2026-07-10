'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Calendar, User, Tag, AlignLeft, MessageCircle, Send, Trash2,
  CheckCircle, Clock, XCircle, AlertTriangle, ChevronDown, Link as LinkIcon,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { MentionInput } from '@/components/ui/MentionInput'
import { useTaskComments } from '@/hooks/useTaskComments'
import { createNotification } from '@/hooks/useNotifications'
import { extractMentionedUserIds } from '@/lib/mentions'
import {
  TASK_TYPE_LABELS, CONTACT_CATEGORY_LABELS, OUTCOME_LABELS, REJECTION_REASON_LABELS,
} from '@/lib/reports'
import { TASK_STATUS_LABELS } from '@/lib/status-comments'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { cn, formatPropertyAddress } from '@/lib/utils'
import type {
  Task, TaskStatus, TaskPriority, Profile,
  TaskType, ContactCategory, TaskOutcome, RejectionReason,
} from '@/types/database'

interface TaskDetailModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Task>) => Promise<any>
  onDelete: (id: string) => Promise<any>
  userId: string
  userName: string
  isAdmin: boolean
  profiles: Profile[]
  tasks: Task[]
}

const statusOptions: { value: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'todo', label: 'Do zrobienia', icon: <CircleIcon />, color: 'text-gray-400' },
  { value: 'in_progress', label: 'W trakcie', icon: <Clock size={14} />, color: 'text-[#448AFF]' },
  { value: 'done', label: 'Zrobione', icon: <CheckCircle size={14} />, color: 'text-[#00E676]' },
  { value: 'blocked', label: 'Zablokowane', icon: <XCircle size={14} />, color: 'text-[#FF3D3D]' },
]

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Niski', color: 'text-gray-400' },
  { value: 'medium', label: 'Średni', color: 'text-[#448AFF]' },
  { value: 'high', label: 'Wysoki', color: 'text-[#FFD600]' },
  { value: 'urgent', label: 'Pilny', color: 'text-[#FF3D3D]' },
]

function CircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

export function TaskDetailModal({
  task, isOpen, onClose, onUpdate, onDelete, userId, userName, isAdmin, profiles, tasks,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState<TaskStatus>(task.status as TaskStatus)
  const [priority, setPriority] = useState<TaskPriority>(task.priority as TaskPriority)
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '')
  const [dueTime, setDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : '')
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showAssignMenu, setShowAssignMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)

  // Etap 0: dane strukturalne z pracy kontaktowej
  const [taskType, setTaskType] = useState<TaskType | ''>(task.task_type || '')
  const [contactCategory, setContactCategory] = useState<ContactCategory | ''>(task.contact_category || '')
  const [outcome, setOutcome] = useState<TaskOutcome | ''>(task.outcome || '')
  const [rejectionReason, setRejectionReason] = useState<RejectionReason | ''>(task.rejection_reason || '')
  const [rejectionNote, setRejectionNote] = useState(task.rejection_note || '')
  // Próba domknięcia bez wyniku — czekamy z „done" aż agent uzupełni
  const [pendingDone, setPendingDone] = useState(false)
  // Każda zmiana statusu wymaga komentarza „dlaczego" — czeka na potwierdzenie
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null)

  const { comments, loading: commentsLoading, addComment, deleteComment } = useTaskComments(task.id)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
    setStatus(task.status as TaskStatus)
    setPriority(task.priority as TaskPriority)
    setDueDate(task.due_date ? task.due_date.split('T')[0] : '')
    setDueTime(task.due_time ? task.due_time.slice(0, 5) : '')
    setAssignedTo(task.assigned_to || '')
    setTaskType(task.task_type || '')
    setContactCategory(task.contact_category || '')
    setOutcome(task.outcome || '')
    setRejectionReason(task.rejection_reason || '')
    setRejectionNote(task.rejection_note || '')
  }, [task])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (isOpen) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function saveField(field: string, value: any) {
    const previousAssignee = task.assigned_to
    await onUpdate(task.id, { [field]: value || null })

    if (field === 'assigned_to' && value && value !== userId && value !== previousAssignee) {
      await createNotification({
        userId: value,
        fromUserId: userId,
        type: 'task_assigned',
        title: `${userName} przypisał/a Ci zadanie`,
        body: task.title.slice(0, 100),
        link: '/zadania',
        referenceId: task.id,
      })
    }
  }

  const isContactTask = taskType === 'wizyta' || taskType === 'telefon'

  function outcomeComplete(o: TaskOutcome | '', reason: RejectionReason | '', note: string): boolean {
    if (!o) return false
    if (o !== 'niezainteresowany') return true
    if (!reason) return false
    if (reason === 'inny' && !note.trim()) return false
    return true
  }

  function handleStatusChange(newStatus: TaskStatus) {
    setShowStatusMenu(false)
    if (newStatus === status) return
    // Wizyta/telefon nie przechodzi w done bez kompletnego wyniku
    if (newStatus === 'done' && isContactTask && !outcomeComplete(outcome, rejectionReason, rejectionNote)) {
      setPendingDone(true)
      return
    }
    setPendingDone(false)
    setPendingStatus(newStatus) // otwiera prompt "dlaczego" — patrz JSX
  }

  async function confirmStatusChange(comment: string) {
    if (!pendingStatus) return
    const newStatus = pendingStatus
    setPendingStatus(null)
    setStatus(newStatus)
    await onUpdate(task.id, { status: newStatus, statusComment: comment } as Partial<Task>)
  }

  async function applyOutcome(
    newOutcome: TaskOutcome | '',
    reason: RejectionReason | '',
    note: string,
  ) {
    setOutcome(newOutcome)
    setRejectionReason(reason)
    setRejectionNote(note)

    // Czyszczenie wyniku domkniętego zadania kontaktowego złamałoby regułę
    if (!newOutcome && status === 'done' && isContactTask) return
    if (newOutcome && !outcomeComplete(newOutcome, reason, note)) return

    const updates: Partial<Task> = {
      outcome: newOutcome || null,
      rejection_reason: newOutcome === 'niezainteresowany' && reason ? reason : null,
      rejection_note: newOutcome === 'niezainteresowany' && reason === 'inny' ? note.trim() : null,
    }
    if (pendingDone && newOutcome) {
      updates.status = 'done'
      setStatus('done')
      setPendingDone(false)
    }
    await onUpdate(task.id, updates)
  }

  async function handlePriorityChange(newPriority: TaskPriority) {
    setPriority(newPriority)
    setShowPriorityMenu(false)
    await saveField('priority', newPriority)
  }

  async function handleAssignChange(profileId: string) {
    setAssignedTo(profileId)
    setShowAssignMenu(false)
    await saveField('assigned_to', profileId || null)
  }

  async function handleTitleSave() {
    setEditingTitle(false)
    if (title.trim() && title !== task.title) {
      await saveField('title', title.trim())
    } else {
      setTitle(task.title)
    }
  }

  async function handleDescSave() {
    setEditingDesc(false)
    if (description !== (task.description || '')) {
      await saveField('description', description || null)
    }
  }

  async function handleDueDateChange(dateStr: string) {
    setDueDate(dateStr)
    await saveField('due_date', dateStr || null)
  }

  async function handleDueTimeChange(timeStr: string) {
    setDueTime(timeStr)
    await saveField('due_time', timeStr || null)
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    setSendingComment(true)
    await addComment(newComment.trim(), userId)

    const mentionedIds = extractMentionedUserIds(newComment, profiles)
    for (const mentionedUserId of mentionedIds) {
      if (mentionedUserId !== userId) {
        await createNotification({
          userId: mentionedUserId,
          fromUserId: userId,
          type: 'mention_task',
          title: `${userName} oznaczył/a Cię w komentarzu`,
          body: newComment.trim().slice(0, 100),
          link: '/zadania',
          referenceId: task.id,
        })
      }
    }

    if (task.assigned_to && task.assigned_to !== userId && !mentionedIds.includes(task.assigned_to)) {
      await createNotification({
        userId: task.assigned_to,
        fromUserId: userId,
        type: 'comment_added',
        title: `${userName} skomentował/a zadanie`,
        body: newComment.trim().slice(0, 100),
        link: '/zadania',
        referenceId: task.id,
      })
    }

    setNewComment('')
    setSendingComment(false)
  }

  async function handleDeleteTask() {
    if (confirm('Na pewno usunąć to zadanie?')) {
      await onDelete(task.id)
      onClose()
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'teraz'
    if (mins < 60) return `${mins}m temu`
    if (hours < 24) return `${hours}h temu`
    if (days < 7) return `${days}d temu`
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const currentStatus = statusOptions.find(s => s.value === status)!
  const currentPriority = priorityOptions.find(p => p.value === priority)!
  const assignee = profiles.find(p => p.id === assignedTo)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-3xl limona-card flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-0 gap-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                className="limona-input text-lg font-bold w-full"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave() }}
                autoFocus
              />
            ) : (
              <h2
                className="text-lg font-bold text-limona-white cursor-pointer hover:text-limona-lime transition-colors leading-snug"
                onClick={() => setEditingTitle(true)}
              >
                {title}
              </h2>
            )}
            {task.property && (
              <a href={`/nieruchomosci/${task.property_id}`}
                className="flex items-center gap-1 text-xs text-limona-blue hover:text-limona-blue/80 mt-1">
                <LinkIcon size={10} />
                {formatPropertyAddress(task.property)}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleDeleteTask}
              className="p-2 text-limona-text-dim hover:text-limona-red transition-colors">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose}
              className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-5 p-5">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Description */}
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-limona-text-muted font-bold mb-2">
                  <AlignLeft size={12} /> Opis
                </label>
                {editingDesc ? (
                  <div>
                    <textarea
                      className="limona-input w-full min-h-[100px] resize-y text-sm"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Dodaj szczegółowy opis..."
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleDescSave} className="limona-btn-sm text-xs">Zapisz</button>
                      <button onClick={() => { setEditingDesc(false); setDescription(task.description || '') }}
                        className="limona-btn-outline text-xs px-3 py-1.5">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'text-sm rounded-lg p-3 cursor-pointer transition-colors min-h-[60px]',
                      description ? 'text-limona-text bg-limona-surface-2/50 hover:bg-limona-surface-2' : 'text-limona-text-dim bg-limona-surface-2/30 hover:bg-limona-surface-2/50'
                    )}
                    onClick={() => setEditingDesc(true)}
                  >
                    {description ? <p className="whitespace-pre-wrap">{description}</p> : <p>Kliknij aby dodać opis...</p>}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-limona-text-muted font-bold mb-3">
                  <MessageCircle size={12} /> Komentarze ({comments.length})
                </label>

                <div className="space-y-3 max-h-72 overflow-y-auto mb-3">
                  {commentsLoading ? (
                    <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-limona-surface-2/50 rounded-lg animate-pulse" />)}</div>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-limona-text-dim text-center py-4">Brak komentarzy</p>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="flex gap-2 group">
                        <Avatar name={comment.user?.full_name || 'Użytkownik'} url={comment.user?.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0 bg-limona-surface-2/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-limona-white">{comment.user?.full_name || 'Użytkownik'}</span>
                            <span className="text-[10px] text-limona-text-dim">{formatTime(comment.created_at)}</span>
                            {(comment.user_id === userId || isAdmin) && (
                              <button onClick={() => deleteComment(comment.id)}
                                className="ml-auto p-0.5 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-limona-text mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <MentionInput
                      value={newComment}
                      onChange={setNewComment}
                      profiles={profiles}
                      tasks={tasks}
                      placeholder="Dodaj komentarz... (@osoba #zadanie)"
                      maxLength={2000}
                      className="text-xs py-2"
                      onSubmit={handleAddComment}
                    />
                  </div>
                  <button onClick={handleAddComment} disabled={sendingComment || !newComment.trim()}
                    className="p-2 text-limona-text-muted hover:text-limona-lime disabled:opacity-30 transition-colors mt-0.5">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:w-52 space-y-3 flex-shrink-0">
              {/* Status */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Status</label>
                <button onClick={() => { setShowStatusMenu(!showStatusMenu); setShowPriorityMenu(false); setShowAssignMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg hover:bg-limona-surface-2/80 transition-colors text-sm">
                  <span className={currentStatus.color}>{currentStatus.icon}</span>
                  <span className="flex-1 text-left">{currentStatus.label}</span>
                  <ChevronDown size={12} className="text-limona-text-dim" />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-limona-surface border border-limona-border rounded-lg shadow-xl z-10 overflow-hidden">
                    {statusOptions.map(opt => (
                      <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left', opt.value === status ? 'bg-limona-lime/20' : 'hover:bg-limona-surface-2')}>
                        <span className={opt.color}>{opt.icon}</span>{opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Priorytet</label>
                <button onClick={() => { setShowPriorityMenu(!showPriorityMenu); setShowStatusMenu(false); setShowAssignMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg hover:bg-limona-surface-2/80 transition-colors text-sm">
                  <Tag size={12} className={currentPriority.color} />
                  <span className="flex-1 text-left">{currentPriority.label}</span>
                  <ChevronDown size={12} className="text-limona-text-dim" />
                </button>
                {showPriorityMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-limona-surface border border-limona-border rounded-lg shadow-xl z-10 overflow-hidden">
                    {priorityOptions.map(opt => (
                      <button key={opt.value} onClick={() => handlePriorityChange(opt.value)}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left', opt.value === priority ? 'bg-limona-lime/20' : 'hover:bg-limona-surface-2')}>
                        <Tag size={12} className={opt.color} />{opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Typ zadania */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Typ zadania</label>
                <select
                  className="limona-select text-sm w-full"
                  value={taskType}
                  onChange={e => {
                    const v = e.target.value as TaskType | ''
                    setTaskType(v)
                    saveField('task_type', v || null)
                  }}
                >
                  <option value="">—</option>
                  {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map(t => (
                    <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Kategoria kontaktu */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Kategoria kontaktu</label>
                <select
                  className="limona-select text-sm w-full"
                  value={contactCategory}
                  onChange={e => {
                    const v = e.target.value as ContactCategory | ''
                    setContactCategory(v)
                    saveField('contact_category', v || null)
                  }}
                >
                  <option value="">—</option>
                  {(Object.keys(CONTACT_CATEGORY_LABELS) as ContactCategory[]).map(c => (
                    <option key={c} value={c}>{CONTACT_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              {/* Wynik kontaktu — wymagany do domknięcia wizyty/telefonu */}
              {(isContactTask || outcome) && (
                <div className={cn(
                  'space-y-2 rounded-lg transition-all',
                  pendingDone && 'p-2 -m-2 border border-limona-red/60 bg-limona-red/5'
                )}>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Wynik</label>
                    <select
                      className="limona-select text-sm w-full"
                      value={outcome}
                      onChange={e => applyOutcome(e.target.value as TaskOutcome | '', rejectionReason, rejectionNote)}
                    >
                      <option value="">—</option>
                      {(Object.keys(OUTCOME_LABELS) as TaskOutcome[]).map(o => (
                        <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
                      ))}
                    </select>
                  </div>

                  {outcome === 'niezainteresowany' && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Powód odmowy</label>
                      <select
                        className="limona-select text-sm w-full"
                        value={rejectionReason}
                        onChange={e => applyOutcome(outcome, e.target.value as RejectionReason | '', rejectionNote)}
                      >
                        <option value="">—</option>
                        {(Object.keys(REJECTION_REASON_LABELS) as RejectionReason[]).map(r => (
                          <option key={r} value={r}>{REJECTION_REASON_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {outcome === 'niezainteresowany' && rejectionReason === 'inny' && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Notatka do powodu</label>
                      <textarea
                        className="limona-input text-xs w-full min-h-[52px] resize-y"
                        value={rejectionNote}
                        onChange={e => setRejectionNote(e.target.value)}
                        onBlur={() => applyOutcome(outcome, rejectionReason, rejectionNote)}
                        placeholder="Dlaczego odmówił?"
                      />
                    </div>
                  )}

                  {pendingDone && (
                    <p className="flex items-center gap-1 text-[10px] text-limona-red">
                      <AlertTriangle size={10} />
                      Uzupełnij wynik, aby domknąć zadanie
                    </p>
                  )}
                </div>
              )}

              {/* Assignee */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Przypisane do</label>
                <button onClick={() => { setShowAssignMenu(!showAssignMenu); setShowStatusMenu(false); setShowPriorityMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg hover:bg-limona-surface-2/80 transition-colors text-sm">
                  {assignee ? (
                    <><Avatar name={assignee.full_name} url={assignee.avatar_url} size="sm" /><span className="flex-1 text-left truncate">{assignee.full_name}</span></>
                  ) : (
                    <><User size={14} className="text-limona-text-dim" /><span className="flex-1 text-left text-limona-text-dim">Nieprzypisane</span></>
                  )}
                  <ChevronDown size={12} className="text-limona-text-dim" />
                </button>
                {showAssignMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-limona-surface border border-limona-border rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    <button onClick={() => handleAssignChange('')}
                      className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left', !assignedTo ? 'bg-limona-lime/20' : 'hover:bg-limona-surface-2')}>
                      <User size={14} className="text-limona-text-dim" /><span className="text-limona-text-dim">Nieprzypisane</span>
                    </button>
                    {profiles.map(p => (
                      <button key={p.id} onClick={() => handleAssignChange(p.id)}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left', p.id === assignedTo ? 'bg-limona-lime/20' : 'hover:bg-limona-surface-2')}>
                        <Avatar name={p.full_name} url={p.avatar_url} size="sm" /><span className="truncate">{p.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Due date */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Termin</label>
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-limona-text-dim flex-shrink-0" />
                  <input type="date" className="limona-input text-xs py-2 flex-1" value={dueDate}
                    onChange={e => handleDueDateChange(e.target.value)} />
                  <input type="time" className="limona-input text-xs py-2 w-24" value={dueTime}
                    disabled={!dueDate} title={!dueDate ? 'Ustaw najpierw datę' : 'Godzina (opcjonalnie)'}
                    onChange={e => handleDueTimeChange(e.target.value)} />
                </div>
                {dueDate && new Date(dueDate) < new Date() && status !== 'done' && (
                  <p className="flex items-center gap-1 text-[10px] text-limona-red mt-1">
                    <AlertTriangle size={10} /> Przeterminowane
                  </p>
                )}
              </div>

              {/* Meta */}
              <div className="pt-3 border-t border-limona-border/50 space-y-1.5">
                {task.creator && (
                  <div className="flex items-center gap-1.5 text-[10px] text-limona-text-dim">
                    <span>Utworzył/a:</span>
                    <Avatar name={task.creator.full_name} size="sm" />
                    <span>{task.creator.full_name}</span>
                  </div>
                )}
                <p className="text-[10px] text-limona-text-dim">
                  Utworzono: {new Date(task.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatusChangeCommentModal
        isOpen={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={confirmStatusChange}
        newStatusLabel={pendingStatus ? TASK_STATUS_LABELS[pendingStatus] : ''}
        entityLabel="zadania"
      />
    </div>
  )
}
