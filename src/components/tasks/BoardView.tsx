'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/Confirm'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { cn, isOverdueDate, taskMatchesAssignee } from '@/lib/utils'
import type { Board, BoardList, Task, Profile } from '@/types/database'

export const BOARD_COLORS = ['#84cc16', '#448AFF', '#FF6D00', '#E040FB', '#F50057', '#FFD600', '#00BCD4', '#4CAF50']

/* ─── BoardView ─── */
interface BoardViewProps {
  board: Board
  visibleIds: string[] | null
  userId: string
  userName: string
  isAdmin: boolean
  canAssign: boolean
  /** Może zakładać zadania prawne (centrala) */
  canCreateLegal?: boolean
  profiles: Profile[]
  allTasks: Task[]
  /** Filtr po agencie (id) — pusty = wszyscy */
  assigneeFilter?: string
  onBoardUpdate: (updates: { name?: string; color?: string }) => Promise<void>
  onBoardDelete: () => Promise<void>
}

export function BoardView({ board, visibleIds, userId, userName, isAdmin, canAssign, canCreateLegal = false, profiles, assigneeFilter = '', onBoardUpdate, onBoardDelete }: BoardViewProps) {
  const confirmDialog = useConfirm()
  const [lists, setLists] = useState<BoardList[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [boardName, setBoardName] = useState(board.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  // Otwarty formularz „Dodaj zadanie" dla konkretnej listy (undefined = zamknięty)
  const [addToList, setAddToList] = useState<string | null | undefined>(undefined)

  const { tasks, loading: _loading, createTask, updateTask, deleteTask, fetchTasks } = useTasks(undefined, visibleIds, board.id)

  const fetchLists = useCallback(async () => {
    const res = await fetch(`/api/boards/${board.id}`)
    if (res.ok) {
      const data = await res.json()
      setLists(data.lists || [])
    }
  }, [board.id])

  useEffect(() => { fetchLists() }, [fetchLists])

  // Keep selectedTask in sync
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks, selectedTask])

  async function addList(name: string) {
    const res = await fetch(`/api/boards/${board.id}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const newList = await res.json()
      setLists(prev => [...prev, newList])
    }
  }

  async function renameList(listId: string, name: string) {
    await fetch(`/api/boards/${board.id}/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLists(prev => prev.map(l => l.id === listId ? { ...l, name } : l))
  }

  async function deleteList(listId: string) {
    await fetch(`/api/boards/${board.id}/lists/${listId}`, { method: 'DELETE' })
    setLists(prev => prev.filter(l => l.id !== listId))
    fetchTasks()
  }

  async function addTaskToList(listId: string, title: string) {
    await createTask({ title, board_id: board.id, list_id: listId, status: 'todo', priority: 'medium' }, userId)
  }

  async function handleCreateTask(data: Partial<Task>) {
    const { error } = await createTask({ ...data, board_id: board.id, list_id: addToList ?? null }, userId)
    return { error: error ?? null }
  }

  async function moveTaskToList(taskId: string, listId: string | null) {
    await updateTask(taskId, { list_id: listId } as Partial<Task>, userId)
  }

  async function saveBoard() {
    if (boardName.trim() && boardName !== board.name) {
      await onBoardUpdate({ name: boardName.trim() })
    }
    setEditingName(false)
  }

  async function handleDeleteTask(id: string, scope?: 'one' | 'following' | 'series') {
    return await deleteTask(id, scope)
  }

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    return await updateTask(id, updates, userId)
  }

  const filteredTasks = tasks.filter(t => taskMatchesAssignee(t, assigneeFilter))
  const tasksByList: Record<string, Task[]> = {}
  for (const l of lists) tasksByList[l.id] = []
  for (const t of filteredTasks) {
    if (t.list_id && tasksByList[t.list_id]) tasksByList[t.list_id].push(t)
  }
  const uncategorized = filteredTasks.filter(t => !t.list_id)

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center gap-3 py-2" style={{ borderLeft: `4px solid ${board.color}`, paddingLeft: '12px' }}>
        {editingName ? (
          <input
            value={boardName}
            onChange={e => setBoardName(e.target.value)}
            onBlur={saveBoard}
            onKeyDown={e => { if (e.key === 'Enter') saveBoard(); if (e.key === 'Escape') { setBoardName(board.name); setEditingName(false) } }}
            autoFocus
            className="bg-transparent text-limona-white font-heading font-bold text-2xl outline-none border-b border-limona-lime"
          />
        ) : (
          <h2 className="font-heading font-bold text-2xl text-limona-white cursor-pointer hover:text-limona-lime" onClick={() => setEditingName(true)}>
            {board.name}
          </h2>
        )}
        <div className="relative">
          <button onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-5 h-5 rounded-full border-2 border-limona-border hover:border-limona-lime transition-colors"
            style={{ backgroundColor: board.color }}
          />
          {showColorPicker && (
            <div className="absolute top-7 left-0 bg-limona-surface border border-limona-border rounded p-2 flex gap-1.5 flex-wrap w-[120px] z-10">
              {BOARD_COLORS.map(c => (
                <button key={c} onClick={() => { onBoardUpdate({ color: c }); setShowColorPicker(false) }}
                  className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white"
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>
        <button onClick={async () => { if (await confirmDialog({ message: `Usunąć tablicę \"${board.name}\"? Zadania zostaną przeniesione do Ogólnych.`, confirmLabel: 'Usuń' })) onBoardDelete() }}
          className="ml-auto p-1.5 text-limona-text-dim hover:text-limona-red transition-colors text-xs flex items-center gap-1 uppercase tracking-wider">
          <Trash2 size={13} /> Usuń tablicę
        </button>
      </div>

      {/* Columns - horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {lists.map(list => (
          <BoardColumn
            key={list.id}
            list={list}
            tasks={tasksByList[list.id] || []}
            allLists={lists}
            onAddTask={(title) => addTaskToList(list.id, title)}
            onOpenAdd={() => setAddToList(list.id)}
            onMoveTask={(taskId, toListId) => moveTaskToList(taskId, toListId)}
            onRename={(name) => renameList(list.id, name)}
            onDelete={() => deleteList(list.id)}
            onOpenTask={setSelectedTask}
            onDeleteTask={(id) => deleteTask(id).then(() => {})}
          />
        ))}

        {uncategorized.length > 0 && (
          <BoardColumn
            key="uncategorized"
            list={{ id: '', name: 'Nieskategoryzowane', position: 9999, board_id: board.id }}
            tasks={uncategorized}
            allLists={lists}
            onAddTask={async () => {}}
            onOpenAdd={() => setAddToList(null)}
            onMoveTask={(taskId, toListId) => moveTaskToList(taskId, toListId)}
            onRename={async () => {}}
            onDelete={async () => {}}
            onOpenTask={setSelectedTask}
            onDeleteTask={(id) => deleteTask(id).then(() => {})}
            isVirtual
          />
        )}

        <AddListForm onAdd={addList} />
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          userId={userId}
          userName={userName}
          isAdmin={isAdmin}
          canAssign={canAssign}
          canCreateLegal={canCreateLegal}
          profiles={profiles}
          tasks={tasks}
        />
      )}

      <TaskFormModal
        isOpen={addToList !== undefined}
        onClose={() => setAddToList(undefined)}
        onCreate={handleCreateTask}
        userId={userId}
        canAssign={canAssign}
        canCreateLegal={canCreateLegal}
        profiles={profiles}
        visibleIds={visibleIds}
        defaults={{ status: 'todo' }}
      />
    </div>
  )
}

/* ─── BoardColumn ─── */
function BoardColumn({
  list, tasks, allLists, onOpenAdd, onMoveTask, onRename, onDelete, onOpenTask, onDeleteTask, isVirtual,
}: {
  list: BoardList
  tasks: Task[]
  allLists: BoardList[]
  onAddTask: (title: string) => Promise<void>
  onOpenAdd: () => void
  onMoveTask: (taskId: string, listId: string | null) => Promise<void>
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onOpenTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  isVirtual?: boolean
}) {
  const confirmDialog = useConfirm()
  const [isRenaming, setIsRenaming] = useState(false)
  const [colName, setColName] = useState(list.name)

  useEffect(() => { setColName(list.name) }, [list.name])

  async function submitRename() {
    if (colName.trim() && colName.trim() !== list.name) await onRename(colName.trim())
    else setColName(list.name)
    setIsRenaming(false)
  }

  return (
    <div className="w-[272px] flex-shrink-0 flex flex-col rounded border border-limona-border bg-limona-surface"
      style={{ maxHeight: 'calc(100vh - 280px)' }}>
      {/* Column header */}
      <div className="p-2.5 flex items-center gap-2 border-b border-limona-border flex-shrink-0">
        {!isVirtual && isRenaming ? (
          <input
            value={colName}
            onChange={e => setColName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setColName(list.name); setIsRenaming(false) } }}
            autoFocus
            className="flex-1 bg-transparent text-limona-white text-sm font-bold outline-none border-b border-limona-lime"
          />
        ) : (
          <button
            onClick={() => !isVirtual && setIsRenaming(true)}
            className={cn('flex-1 text-xs font-bold uppercase tracking-wider text-left truncate', isVirtual ? 'text-limona-text-dim' : 'text-limona-text-muted hover:text-limona-white cursor-pointer')}
          >
            {list.name}
          </button>
        )}
        <span className="text-xs bg-limona-border/50 rounded-full px-2 py-0.5 font-mono text-limona-text-muted flex-shrink-0">
          {tasks.length}
        </span>
        {!isVirtual && (
          <>
            <button onClick={onOpenAdd} className="p-0.5 text-limona-text-dim hover:text-limona-lime transition-colors flex-shrink-0">
              <Plus size={14} />
            </button>
            <button onClick={async () => { if (await confirmDialog({ message: 'Usunąć tę listę? Zadania zostaną odkategoryzowane.', confirmLabel: 'Usuń' })) onDelete() }}
              className="p-0.5 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map(task => (
          <BoardTaskCard
            key={task.id}
            task={task}
            allLists={allLists}
            onMoveToList={(listId) => onMoveTask(task.id, listId)}
            onOpen={() => onOpenTask(task)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-limona-text-dim text-xs py-4">Brak kart</p>
        )}
      </div>

      {/* Dodaj kartę — pełny formularz zadania */}
      {!isVirtual && (
        <div className="p-2 border-t border-limona-border flex-shrink-0">
          <button onClick={onOpenAdd}
            className="w-full text-left text-xs text-limona-text-dim hover:text-limona-lime transition-colors flex items-center gap-1.5 px-1 py-1">
            <Plus size={12} /> Dodaj kartę
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── BoardTaskCard ─── */
function BoardTaskCard({ task, allLists, onMoveToList, onOpen, onDelete }: {
  task: Task
  allLists: BoardList[]
  onMoveToList: (listId: string | null) => void
  onOpen: () => void
  onDelete: () => void
}) {
  const isOverdue = !!(task.due_date && task.status !== 'done' && isOverdueDate(task.due_date))

  return (
    <div
      className={cn('limona-card p-3 group cursor-pointer hover:border-limona-lime/40 transition-all space-y-2', task.status === 'done' && 'opacity-60')}
      onClick={onOpen}
    >
      <div className="flex items-start gap-1">
        <p className={cn('text-sm font-medium leading-snug flex-1', task.status === 'done' && 'line-through text-limona-text-muted')}>
          {task.title}
        </p>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-limona-text-dim hover:text-limona-red flex-shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-limona-text-dim line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge value={task.priority} />
        {task.assignee && <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size="sm" />}
        {isOverdue && <span className="text-[10px] text-limona-red uppercase tracking-wider">⚠ Termin</span>}
        {task.due_date && !isOverdue && (
          <span className="text-[10px] text-limona-text-dim">
            {new Date(task.due_date).toLocaleDateString('pl-PL')}{task.due_time && ` ${task.due_time.slice(0, 5)}`}
          </span>
        )}
      </div>

      {/* Move to list buttons */}
      {allLists.length > 1 && (
        <div className="flex gap-1 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity">
          {allLists.filter(l => l.id !== task.list_id).map(l => (
            <button key={l.id} onClick={e => { e.stopPropagation(); onMoveToList(l.id) }}
              className="text-[9px] px-2 py-0.5 bg-limona-border/30 hover:bg-limona-lime/20 hover:text-limona-lime rounded-full uppercase tracking-wider transition-colors">
              → {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── AddListForm ─── */
function AddListForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(name.trim())
    setName('')
    setShow(false)
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        className="w-[272px] flex-shrink-0 border-2 border-dashed border-limona-border hover:border-limona-lime/50 rounded p-4 text-limona-text-dim hover:text-limona-lime flex items-center gap-2 transition-colors self-start">
        <Plus size={16} /> Dodaj listę
      </button>
    )
  }

  return (
    <div className="w-[272px] flex-shrink-0 bg-limona-surface rounded border border-limona-lime/30 p-3 self-start">
      <form onSubmit={submit}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          placeholder="Nazwa listy..."
          className="limona-input w-full text-sm mb-2"
          onKeyDown={e => { if (e.key === 'Escape') { setShow(false); setName('') } }}
        />
        <div className="flex gap-2">
          <button type="submit" className="limona-btn-sm text-xs">Dodaj listę</button>
          <button type="button" onClick={() => { setShow(false); setName('') }} className="text-limona-text-dim hover:text-limona-white">
            <X size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
