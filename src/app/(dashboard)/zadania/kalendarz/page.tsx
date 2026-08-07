'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { LayoutGrid, CalendarRange, List } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { useTasks } from '@/hooks/useTasks'
import { CalendarView } from '@/components/tasks/CalendarView'
import { AgendaView } from '@/components/tasks/AgendaView'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { TaskSearchBar, TaskSearchResults, searchTasks } from '@/components/tasks/TaskSearch'
import { canSeeAllTeams } from '@/lib/roles'
import { cn, taskMatchesAssignee } from '@/lib/utils'
import { usePersistentState } from '@/hooks/usePersistentState'
import type { Task, Profile } from '@/types/database'

type CalMode = 'agenda' | 'grid'

// Samodzielny widok kalendarza — agreguje zadania ze wszystkich tablic.
// Dwa tryby: Terminarz (agenda, domyślny na telefonie) i Siatka (3 dni/miesiąc).
export default function ZadaniaKalendarzPage() {
  const { user, profile } = useAuth()
  const canAssign = canSeeAllTeams(profile?.role)
  const { visibleIds, loading: visLoading } = useVisibleUserIds(user?.id, profile?.role)
  const { tasks, loading, createTask, updateTask, deleteTask, reorderTasks } = useTasks(undefined, visibleIds, undefined, undefined, !visLoading)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [assigneeFilter, setAssigneeFilter] = usePersistentState('zadania:assignee', '')
  // Filtr po agencie ma sens tylko, gdy widać zadania więcej niż jednej osoby
  const canFilterByAgent = canAssign || (visibleIds?.length ?? 0) > 1
  const filteredTasks = tasks.filter(t => taskMatchesAssignee(t, assigneeFilter))

  // Wyszukiwarka zadań — po tytule, opisie i powiązanej encji (nieruchomość /
  // kontakt / lead). Przeszukuje WSZYSTKIE zadania niezależnie od daty, więc
  // łatwo wrócić do sprawy sprzed tygodni („marki", numer telefonu itd.).
  const [search, setSearch] = useState('')
  const searching = search.trim().length > 0
  const searchResults = useMemo(() => searchTasks(filteredTasks, search), [filteredTasks, search])

  // Kolejność nawigacji ‹ › w modalu — chronologicznie (najbliższy termin
  // u góry), zgodnie z układem terminarza; bez terminu na końcu.
  const navTasks = useMemo(() => {
    const key = (t: Task) => t.due_date ? `${t.due_date} ${t.due_time ?? '99:99'}` : '9999-99-99'
    return [...filteredTasks].sort((a, b) => {
      const ak = key(a), bk = key(b)
      if (ak !== bk) return ak < bk ? -1 : 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [filteredTasks])
  const taskNavIndex = selectedTask ? navTasks.findIndex(t => t.id === selectedTask.id) : -1
  // Kontekst otwartego formularza dodawania (prefiltrowany termin/godzina)
  const [addCtx, setAddCtx] = useState<{ date: string; time: string | null } | null>(null)

  // Tryb: zapamiętany wybór > telefon=terminarz, desktop=siatka
  const [mode, setMode] = useState<CalMode | null>(null)
  useEffect(() => {
    const saved = localStorage.getItem('kalendarz-mode') as CalMode | null
    if (saved === 'agenda' || saved === 'grid') { setMode(saved); return }
    setMode(window.matchMedia('(max-width: 1023px)').matches ? 'agenda' : 'grid')
  }, [])
  function switchMode(m: CalMode) {
    setMode(m)
    localStorage.setItem('kalendarz-mode', m)
  }

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

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    if (!user) return { error: 'No user' }
    return await updateTask(id, updates, user.id)
  }

  async function handleDeleteTask(id: string, scope?: 'one' | 'following' | 'series') {
    return await deleteTask(id, scope)
  }

  async function handleCreateTask(data: Partial<Task>) {
    if (!user) return { error: 'Brak użytkownika' }
    const { error } = await createTask(data, user.id)
    return { error: error ?? null }
  }

  async function handleMoveTask(taskId: string, dueDateKey: string, dueTime: string | null) {
    if (!user) return
    await updateTask(taskId, { due_date: dueDateKey, due_time: dueTime }, user.id)
  }

  async function handleToggleDone(task: Task) {
    if (!user) return
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }, user.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="limona-eyebrow">Workflow</span>
          <h1 className="limona-heading text-2xl lg:text-3xl mt-1">Terminarz</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canFilterByAgent && (
            <select
              className="limona-select text-xs py-1.5"
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              title="Filtruj po agencie"
            >
              <option value="">Wszyscy agenci</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 p-1 bg-limona-bg rounded border border-limona-border">
            {([
              ['agenda', List, 'Terminarz'],
              ['grid', CalendarRange, 'Siatka'],
            ] as [CalMode, React.ElementType, string][]).map(([m, Icon, label]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium transition-colors',
                  mode === m ? 'bg-limona-lime text-black' : 'text-limona-text-muted hover:text-limona-white'
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <Link href="/zadania" className="limona-btn-outline flex items-center gap-2 text-xs">
            <LayoutGrid size={14} />
            Kanban
          </Link>
        </div>
      </div>

      {/* Wyszukiwarka zadań — po wszystkich datach */}
      <TaskSearchBar value={search} onChange={setSearch} />

      {searching && <TaskSearchResults results={searchResults} query={search} onOpen={setSelectedTask} />}

      {!searching && mode === 'agenda' && (
        <AgendaView
          tasks={filteredTasks}
          loading={loading}
          onOpenTask={setSelectedTask}
          onToggleDone={handleToggleDone}
          onRequestAdd={(date, time) => setAddCtx({ date, time })}
          onReorder={reorderTasks}
        />
      )}

      {!searching && mode === 'grid' && (
        <CalendarView
          tasks={filteredTasks}
          loading={loading}
          profiles={profiles}
          onOpenTask={setSelectedTask}
          onRequestAdd={(date, time) => setAddCtx({ date, time })}
          onMoveTask={handleMoveTask}
          onReorder={reorderTasks}
        />
      )}

      <TaskFormModal
        isOpen={!!addCtx}
        onClose={() => setAddCtx(null)}
        onCreate={handleCreateTask}
        userId={user?.id || ''}
        canAssign={canAssign}
        profiles={profiles}
        visibleIds={visibleIds}
        defaults={{ status: 'todo', due_date: addCtx?.date ?? '', due_time: addCtx?.time ?? '' }}
      />

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
          onNavigate={dir => { const next = navTasks[taskNavIndex + dir]; if (next) setSelectedTask(next) }}
          hasPrev={taskNavIndex > 0}
          hasNext={taskNavIndex >= 0 && taskNavIndex < navTasks.length - 1}
        />
      )}
    </div>
  )
}
