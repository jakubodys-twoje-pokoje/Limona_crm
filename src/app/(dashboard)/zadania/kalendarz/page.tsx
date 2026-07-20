'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { useTasks } from '@/hooks/useTasks'
import { CalendarView } from '@/components/tasks/CalendarView'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { canSeeAllTeams } from '@/lib/roles'
import type { Task, Profile } from '@/types/database'

// Samodzielny widok kalendarza — agreguje zadania ze wszystkich tablic
// (boardId pominięty w useTasks = brak filtra po stronie API), bez zakładek kanbanu
export default function ZadaniaKalendarzPage() {
  const { user, profile } = useAuth()
  const canAssign = canSeeAllTeams(profile?.role)
  const { visibleIds, loading: visLoading } = useVisibleUserIds(user?.id, profile?.role)
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks(undefined, visibleIds, undefined, undefined, !visLoading)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

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

  async function handleQuickAddTask(title: string, dueDateKey: string, dueTime: string | null) {
    if (!user) return
    await createTask({ title, due_date: dueDateKey, due_time: dueTime, status: 'todo', priority: 'medium' }, user.id)
  }

  async function handleMoveTask(taskId: string, dueDateKey: string, dueTime: string | null) {
    if (!user) return
    await updateTask(taskId, { due_date: dueDateKey, due_time: dueTime }, user.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="limona-eyebrow">Workflow</span>
          <h1 className="limona-heading text-3xl mt-1">Kalendarz zadań</h1>
        </div>
        <Link href="/zadania" className="limona-btn-outline flex items-center gap-2 text-xs">
          <LayoutGrid size={14} />
          Kanban
        </Link>
      </div>

      <CalendarView
        tasks={tasks}
        loading={loading}
        profiles={profiles}
        onOpenTask={setSelectedTask}
        onQuickAddTask={handleQuickAddTask}
        onMoveTask={handleMoveTask}
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
        />
      )}
    </div>
  )
}
