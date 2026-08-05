'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, Phone, Mail, MapPin, Tag, Flame, Snowflake, Sun, Calendar, User,
  MessageCircle, Send, Trash2, ChevronDown, ArrowRight, AlertTriangle, ExternalLink,
  ListTodo, Plus, CheckCircle, Circle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SortToggle } from '@/components/ui/SortToggle'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { RequestDeletionModal } from '@/components/shared/RequestDeletionModal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { createNotification } from '@/hooks/useNotifications'
import { useTasks } from '@/hooks/useTasks'
import { LEAD_STATUS_LABELS } from '@/lib/status-comments'
import { LEAD_TRANSITIONS } from '@/lib/lead-rules'
import { cn, isOverdueDate, sortByCreatedAt, type SortDirection } from '@/lib/utils'
import { DriveFiles } from '@/components/shared/DriveFiles'
import { useConfirm } from '@/components/ui/Confirm'
import type { Lead, LeadComment, LeadStatus, LeadTemperature, Profile, Task } from '@/types/database'

export const TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; color: string; icon: React.ReactNode }> = {
  hot: { label: 'Gorący', color: 'text-limona-red', icon: <Flame size={13} /> },
  warm: { label: 'Ciepły', color: 'text-limona-yellow', icon: <Sun size={13} /> },
  cold: { label: 'Zimny', color: 'text-limona-blue', icon: <Snowflake size={13} /> },
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-limona-border/60 text-limona-text-muted',
  contacted: 'bg-limona-blue/20 text-limona-blue',
  qualified: 'bg-limona-yellow/20 text-limona-yellow',
  assigned: 'bg-limona-lime/20 text-limona-lime',
  converted: 'bg-limona-green/20 text-limona-green',
  rejected: 'bg-limona-red/20 text-limona-red',
}

interface LeadDetailModalProps {
  lead: Lead
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<{ error: string | null }>
  onDelete: ((id: string) => Promise<void>) | null
  onConvert: () => void
  userId: string
  userName: string
  isAdmin: boolean
  canAssign: boolean
  /** Czy użytkownik może usuwać wprost (centrala/zarząd) — inaczej „Zgłoś do usunięcia" */
  canDelete: boolean
  profiles: Profile[]
  /** Nawigacja ‹ › po aktualnie przefiltrowanej liście (opcjonalna) */
  onNavigate?: (dir: -1 | 1) => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function LeadDetailModal({
  lead, isOpen, onClose, onUpdate, onDelete, onConvert, userId, userName, isAdmin, canAssign, canDelete, profiles,
  onNavigate, hasPrev, hasNext,
}: LeadDetailModalProps) {
  const confirmDialog = useConfirm()
  const [comments, setComments] = useState<LeadComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showAssignMenu, setShowAssignMenu] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(lead.notes || '')
  const [showRequestDelete, setShowRequestDelete] = useState(false)

  // Zadania leada — jak na kartach nieruchomości i kontaktów
  const { tasks, createTask, updateTask, deleteTask } = useTasks(undefined, undefined, undefined, undefined, isOpen, lead.id)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/leads/${lead.id}/comments`)
    if (res.ok) setComments(await res.json())
    setCommentsLoading(false)
  }, [lead.id])

  useEffect(() => { fetchComments() }, [fetchComments])
  useEffect(() => { setNotes(lead.notes || '') }, [lead.notes])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    // Escape zamyka leada tylko gdy żaden zagnieżdżony modal zadania nie jest otwarty
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape' && !selectedTask && !showAddTask) onClose() }
    if (isOpen) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose, selectedTask, showAddTask])

  // Utrzymuj otwarte zadanie w synchronizacji z odświeżaną listą
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks, selectedTask])

  if (!isOpen) return null

  const isFrozen = lead.status === 'converted'
  const allowedStatuses = LEAD_TRANSITIONS[lead.status] ?? []
  const assignee = profiles.find(p => p.id === lead.assigned_to)
  const followUpOverdue = lead.next_contact_at && isOverdueDate(lead.next_contact_at) && !isFrozen && lead.status !== 'rejected'

  async function handleAddComment() {
    if (!newComment.trim()) return
    setSending(true)
    const res = await fetch(`/api/leads/${lead.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    })
    if (res.ok) {
      setNewComment('')
      fetchComments()
      // Powiadomienie prowadzącego i kierownictwa dokłada serwer
      // (POST /api/leads/[id]/comments → notifyCardActivity)
    }
    setSending(false)
  }

  async function confirmStatusChange(comment: string) {
    if (!pendingStatus) return
    const status = pendingStatus
    setPendingStatus(null)
    await onUpdate(lead.id, { status, statusComment: comment })
    fetchComments()
  }

  async function handleAssign(profileId: string) {
    setShowAssignMenu(false)
    const { error } = await onUpdate(lead.id, { assignedTo: profileId || null })
    if (!error && profileId && profileId !== userId) {
      await createNotification({
        userId: profileId,
        fromUserId: userId,
        type: 'new_lead',
        title: `${userName} przypisał/a Ci leada`,
        body: lead.name,
        link: `/leady?open=${lead.id}`,
        referenceId: lead.id,
      })
    }
  }

  async function saveNotes() {
    setEditingNotes(false)
    if (notes !== (lead.notes || '')) await onUpdate(lead.id, { notes: notes || null })
  }

  // Przejście do sąsiedniego leada — zapisujemy edytowane notatki, żeby nic
  // nie przepadło, po czym prosimy rodzica o zmianę leada.
  async function requestNavigate(dir: -1 | 1) {
    if (editingNotes && notes !== (lead.notes || '')) await saveNotes()
    setEditingNotes(false)
    onNavigate?.(dir)
  }

  async function handleCreateTask(data: Partial<Task>) {
    const { error } = await createTask({ ...data, lead_id: lead.id }, userId)
    return { error: error ?? null }
  }

  async function handleToggleTask(task: Task) {
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }, userId)
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

  const sortedComments = sortByCreatedAt(comments, sortDir)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-3xl limona-card flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-limona-white leading-snug">{lead.name}</h2>
              <span className={cn('limona-badge text-[10px]', LEAD_STATUS_COLORS[lead.status])}>
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              <span className={cn('flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold', TEMPERATURE_CONFIG[lead.temperature].color)}>
                {TEMPERATURE_CONFIG[lead.temperature].icon}
                {TEMPERATURE_CONFIG[lead.temperature].label}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-limona-lime hover:underline">
                  <Phone size={11} /> {lead.phone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-limona-blue hover:underline">
                  <Mail size={11} /> {lead.email}
                </a>
              )}
              {lead.location && (
                <span className="flex items-center gap-1 text-limona-text-muted">
                  <MapPin size={11} /> {lead.location}
                </span>
              )}
              {lead.source && (
                <span className="flex items-center gap-1 text-limona-text-dim">
                  <Tag size={11} /> {lead.source}
                </span>
              )}
            </div>
            {isFrozen && (
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <span className="text-[10px] uppercase tracking-wider text-limona-green font-bold">
                  Skonwertowany {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString('pl-PL') : ''} — tylko do odczytu
                </span>
                {lead.property_id && (
                  <a href={`/nieruchomosci/${lead.property_id}`} className="flex items-center gap-1 text-[11px] text-limona-blue hover:underline">
                    <ExternalLink size={10} /> Nieruchomość
                  </a>
                )}
                {lead.kontakt_id && (
                  <a href={`/kontakty/${lead.kontakt_id}`} className="flex items-center gap-1 text-[11px] text-limona-lime hover:underline">
                    <ExternalLink size={10} /> Klient
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onNavigate && (
              <div className="flex items-center mr-0.5 border-r border-limona-border/50 pr-1">
                <button onClick={() => requestNavigate(-1)} disabled={!hasPrev} title="Poprzedni lead"
                  className="p-2 text-limona-text-dim hover:text-limona-lime disabled:opacity-25 disabled:hover:text-limona-text-dim transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => requestNavigate(1)} disabled={!hasNext} title="Następny lead"
                  className="p-2 text-limona-text-dim hover:text-limona-lime disabled:opacity-25 disabled:hover:text-limona-text-dim transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {canDelete && onDelete ? (
              <button
                onClick={async () => { if (await confirmDialog({ message: 'Na pewno usunąć tego leada? Historia przepadnie.', confirmLabel: 'Usuń' })) { await onDelete(lead.id); onClose() } }}
                className="p-2 text-limona-text-dim hover:text-limona-red transition-colors"
                title="Usuń leada"
              >
                <Trash2 size={16} />
              </button>
            ) : !isFrozen && (
              <button
                onClick={() => setShowRequestDelete(true)}
                className="p-2 text-limona-text-dim hover:text-limona-red transition-colors"
                title="Zgłoś do usunięcia"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Na mobile panel (status, prowadzący, następny kontakt) nad
              notatkami i komentarzami — inaczej pola były spychane na sam dół.
              Desktop bez zmian (treść z lewej, panel z prawej). */}
          <div className="flex flex-col-reverse lg:flex-row gap-5 p-5 pt-0">
            {/* Main */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Notatki */}
              <div>
                <label className="text-xs uppercase tracking-wider text-limona-text-muted font-bold block mb-2">Notatki</label>
                {editingNotes && !isFrozen ? (
                  <div>
                    <textarea
                      className="limona-input w-full min-h-[180px] resize-y text-sm"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={saveNotes} className="limona-btn-sm text-xs">Zapisz</button>
                      <button onClick={() => { setEditingNotes(false); setNotes(lead.notes || '') }} className="limona-btn-outline text-xs px-3 py-1.5">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'text-sm rounded-lg p-3 min-h-[48px] transition-colors',
                      !isFrozen && 'cursor-pointer',
                      notes ? 'text-limona-text bg-limona-surface-2/50' : 'text-limona-text-dim bg-limona-surface-2/30',
                      !isFrozen && 'hover:bg-limona-surface-2',
                    )}
                    onClick={() => { if (!isFrozen) setEditingNotes(true) }}
                  >
                    {notes ? <p className="whitespace-pre-wrap">{notes}</p> : <p>{isFrozen ? 'Brak notatek' : 'Kliknij aby dodać notatki...'}</p>}
                  </div>
                )}
              </div>

              {/* Dokumenty w Google Drive */}
              <DriveFiles entity="lead" id={lead.id} />

              {/* Zadania — jak na kartach nieruchomości i kontaktów */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-limona-text-muted font-bold">
                    <ListTodo size={12} /> Zadania ({tasks.length})
                  </label>
                  {!isFrozen && (
                    <button onClick={() => setShowAddTask(true)}
                      className="flex items-center gap-1 text-xs text-limona-text-dim hover:text-limona-lime transition-colors">
                      <Plus size={13} /> Dodaj
                    </button>
                  )}
                </div>
                {tasks.length === 0 ? (
                  <p className="text-xs text-limona-text-dim text-center py-3">Brak zadań</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="flex items-center gap-3 p-2.5 rounded bg-limona-surface-2/40 cursor-pointer hover:bg-limona-surface-2 transition-colors"
                      >
                        <button
                          onClick={e => { e.stopPropagation(); handleToggleTask(task) }}
                          className={cn('flex-shrink-0 transition-colors', task.status === 'done' ? 'text-limona-green' : 'text-limona-text-dim hover:text-limona-lime')}
                        >
                          {task.status === 'done' ? <CheckCircle size={16} /> : <Circle size={16} />}
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
                        <Badge value={task.priority} />
                        <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }} className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Komentarze */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-limona-text-muted font-bold">
                    <MessageCircle size={12} /> Komentarze ({comments.length})
                  </label>
                  {comments.length > 1 && <SortToggle dir={sortDir} onToggle={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} />}
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto mb-3">
                  {commentsLoading ? (
                    <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-limona-surface-2/50 rounded-lg animate-pulse" />)}</div>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-limona-text-dim text-center py-4">Brak komentarzy</p>
                  ) : (
                    sortedComments.map(comment => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar name={comment.user?.full_name || 'System'} url={comment.user?.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0 bg-limona-surface-2/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-limona-white">{comment.user?.full_name || 'System (webhook)'}</span>
                            <span className="text-[10px] text-limona-text-dim">{formatTime(comment.created_at)}</span>
                          </div>
                          <p className="text-sm text-limona-text mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {!isFrozen && (
                  <div className="flex gap-2 items-start">
                    <textarea
                      className="limona-input flex-1 text-xs py-2 resize-y"
                      rows={2}
                      placeholder="Dodaj komentarz... (Ctrl+Enter wysyła, Enter to nowa linia)"
                      value={newComment}
                      maxLength={2000}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          handleAddComment()
                        }
                      }}
                    />
                    <button onClick={handleAddComment} disabled={sending || !newComment.trim()}
                      title="Wyślij (Ctrl+Enter)"
                      className="p-2 text-limona-text-muted hover:text-limona-lime disabled:opacity-30 transition-colors mt-0.5">
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:w-56 space-y-3 flex-shrink-0">
              {/* Konwersja — główna akcja */}
              {!isFrozen && lead.status !== 'rejected' && (
                <button
                  onClick={onConvert}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-limona-lime text-black text-xs font-bold uppercase tracking-wider hover:bg-limona-lime-hover transition-colors"
                >
                  <ArrowRight size={13} />
                  Rozbij na nieruchomość i klienta
                </button>
              )}

              {/* Status */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Status</label>
                <button
                  disabled={isFrozen || allowedStatuses.length === 0}
                  onClick={() => { setShowStatusMenu(!showStatusMenu); setShowAssignMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg hover:bg-limona-surface-2/80 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex-1 text-left">{LEAD_STATUS_LABELS[lead.status]}</span>
                  <ChevronDown size={12} className="text-limona-text-dim" />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-limona-surface border border-limona-border rounded-lg shadow-xl z-10 overflow-hidden">
                    {allowedStatuses.map(s => (
                      <button key={s} onClick={() => { setShowStatusMenu(false); setPendingStatus(s) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left hover:bg-limona-surface-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', LEAD_STATUS_COLORS[s].split(' ')[0])} />
                        {LEAD_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-limona-text-dim mt-1">Konwersja tylko przyciskiem powyżej — status pilnuje kolejności</p>
              </div>

              {/* Temperatura */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Temperatura</label>
                <div className="flex gap-1">
                  {(Object.keys(TEMPERATURE_CONFIG) as LeadTemperature[]).map(t => (
                    <button
                      key={t}
                      disabled={isFrozen}
                      onClick={() => onUpdate(lead.id, { temperature: t })}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed',
                        lead.temperature === t
                          ? `border-current ${TEMPERATURE_CONFIG[t].color} bg-limona-surface-2`
                          : 'border-limona-border text-limona-text-dim hover:border-limona-text-muted',
                      )}
                    >
                      {TEMPERATURE_CONFIG[t].icon}
                      {TEMPERATURE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prowadzący */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Prowadzi</label>
                {canAssign && !isFrozen ? (
                  <>
                    <button onClick={() => { setShowAssignMenu(!showAssignMenu); setShowStatusMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg hover:bg-limona-surface-2/80 transition-colors text-sm">
                      {assignee ? (
                        <><Avatar name={assignee.full_name} url={assignee.avatar_url} size="sm" /><span className="flex-1 text-left truncate">{assignee.full_name}</span></>
                      ) : (
                        <><User size={14} className="text-limona-text-dim" /><span className="flex-1 text-left text-limona-text-dim">Nieprzypisany</span></>
                      )}
                      <ChevronDown size={12} className="text-limona-text-dim" />
                    </button>
                    {showAssignMenu && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-limona-surface border border-limona-border rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                        <button onClick={() => handleAssign('')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left hover:bg-limona-surface-2">
                          <User size={14} className="text-limona-text-dim" /><span className="text-limona-text-dim">Nieprzypisany</span>
                        </button>
                        {profiles.map(p => (
                          <button key={p.id} onClick={() => handleAssign(p.id)}
                            className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left', p.id === lead.assigned_to ? 'bg-limona-lime/20' : 'hover:bg-limona-surface-2')}>
                            <Avatar name={p.full_name} url={p.avatar_url} size="sm" /><span className="truncate">{p.full_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full flex items-center gap-2 px-3 py-2 bg-limona-surface-2 rounded-lg text-sm">
                    {assignee ? (
                      <><Avatar name={assignee.full_name} url={assignee.avatar_url} size="sm" /><span className="flex-1 truncate">{assignee.full_name}</span></>
                    ) : (
                      <><User size={14} className="text-limona-text-dim" /><span className="flex-1 text-limona-text-dim">Nieprzypisany</span></>
                    )}
                  </div>
                )}
              </div>

              {/* Następny kontakt */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold block mb-1">Następny kontakt</label>
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-limona-text-dim flex-shrink-0" />
                  <input
                    type="date"
                    disabled={isFrozen}
                    className="limona-input text-xs py-2 flex-1"
                    value={lead.next_contact_at ? lead.next_contact_at.slice(0, 10) : ''}
                    onChange={e => onUpdate(lead.id, { nextContactAt: e.target.value || null })}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 gap-2">
                  {followUpOverdue ? (
                    <p className="flex items-center gap-1 text-[10px] text-limona-red">
                      <AlertTriangle size={10} /> Kontakt zaległy
                    </p>
                  ) : <span />}
                  {lead.next_contact_at && !isFrozen && (
                    <button type="button" onClick={() => onUpdate(lead.id, { nextContactAt: null })}
                      className="inline-flex items-center gap-1 text-[11px] text-limona-text-dim hover:text-limona-red transition-colors py-1 flex-shrink-0">
                      <X size={12} /> Wyczyść
                    </button>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="pt-3 border-t border-limona-border/50 space-y-1.5">
                {lead.creator && (
                  <div className="flex items-center gap-1.5 text-[10px] text-limona-text-dim">
                    <span>Dodał/a:</span>
                    <Avatar name={lead.creator.full_name} size="sm" />
                    <span>{lead.creator.full_name}</span>
                  </div>
                )}
                {!lead.created_by && (
                  <p className="text-[10px] text-limona-text-dim">Źródło: webhook (automat)</p>
                )}
                <p className="text-[10px] text-limona-text-dim">
                  Utworzono: {new Date(lead.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {typeof lead.meta?.webhook_resubmissions === 'number' && (
                  <p className="text-[10px] text-limona-yellow">
                    Ponownych zgłoszeń: {lead.meta.webhook_resubmissions as number}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatusChangeCommentModal
        isOpen={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={confirmStatusChange}
        newStatusLabel={pendingStatus ? LEAD_STATUS_LABELS[pendingStatus] : ''}
        entityLabel="leada"
      />

      <RequestDeletionModal
        isOpen={showRequestDelete}
        onClose={() => setShowRequestDelete(false)}
        entityType="lead"
        entityId={lead.id}
        entityLabel={lead.name}
        onDone={onClose}
      />

      <TaskFormModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onCreate={handleCreateTask}
        userId={userId}
        canAssign={canAssign}
        profiles={profiles}
        lockedLeadLabel={lead.name}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (id, updates) => updateTask(id, updates, userId)}
          onDelete={async (id, scope) => deleteTask(id, scope)}
          userId={userId}
          userName={userName}
          isAdmin={isAdmin}
          canAssign={canAssign}
          profiles={profiles}
          tasks={tasks}
        />
      )}
    </div>
  )
}
