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
import type { Task, Profile } from '@/types/database'

// Samodzielny widok kalendarza — agreguje zadania ze wszystkich tablic
// (boardId pominięty w useTasks = brak filtra po stronie API), bez zakładek kanbanu
export default function ZadaniaKalendarzPage() {
  const { user, profile } = useAuth()
  const { visibleIds } = useVisibleUserIds(user?.id, profile?.role)
  const { tasks, loading, updateTask, deleteTask } = useTasks(undefined, visibleIds)
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

  async function handleDeleteTask(id: string) {
    return await deleteTask(id)
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
          profiles={profiles}
          tasks={tasks}
        />
      )}
    </div>
  )
}
