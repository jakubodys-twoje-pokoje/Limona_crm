'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, AlertTriangle,
  Link as LinkIcon, BookUser, CheckCircle2, Circle, Plus,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn, formatPropertyAddress } from '@/lib/utils'
import type { Task, TaskPriority, Profile } from '@/types/database'

const DAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']
const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-limona-red',
  high: 'bg-orange-500',
  medium: 'bg-limona-blue',
  low: 'bg-limona-text-dim',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Pilny', high: 'Wysoki', medium: 'Średni', low: 'Niski',
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const NO_BOARD_COLOR = '#6b7280'
const NO_BOARD_NAME = 'Ogólne'

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Poniedziałek jako pierwszy dzień tygodnia zawierającego `date`
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

interface CalendarViewProps {
  /** Zadania ze WSZYSTKICH tablic — kalendarz nie zależy od wybranej zakładki kanbanu */
  tasks: Task[]
  loading: boolean
  profiles: Profile[]
  onOpenTask: (t: Task) => void
  /** Szybkie dodanie zadania z terminem na wybrany dzień (klik na kartkę w kalendarzu) */
  onQuickAddTask?: (title: string, dueDateKey: string) => Promise<void>
}

export function CalendarView({ tasks, loading, profiles, onOpenTask, onQuickAddTask }: CalendarViewProps) {
  const [mode, setMode] = useState<'day' | 'month'>('day')
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddSaving, setQuickAddSaving] = useState(false)

  function openQuickAdd(dateKey: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setQuickAddTitle('')
    setQuickAddDate(dateKey)
  }

  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!quickAddTitle.trim() || !quickAddDate || !onQuickAddTask) return
    setQuickAddSaving(true)
    try {
      await onQuickAddTask(quickAddTitle.trim(), quickAddDate)
      setQuickAddDate(null)
      setQuickAddTitle('')
    } finally {
      setQuickAddSaving(false)
    }
  }

  const todayKey = toDateKey(new Date())

  const visibleTasks = useMemo(() => {
    let t = tasks
    if (assigneeFilter) {
      t = t.filter(task => task.assigned_to === assigneeFilter || task.co_assignees?.includes(assigneeFilter))
    }
    return t
  }, [tasks, assigneeFilter])

  // Zadania z terminem, pogrupowane po dacie (YYYY-MM-DD) — do miesiąca i paska tygodnia
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of visibleTasks) {
      if (!t.due_date) continue
      const key = t.due_date.slice(0, 10)
      ;(map[key] ??= []).push(t)
    }
    return map
  }, [visibleTasks])

  function selectDate(key: string) {
    setSelectedDate(key)
    const d = parseDateKey(key)
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() })
    setMode('day')
  }

  function goToday() {
    selectDate(todayKey)
  }

  // ── Widok dzienny ──────────────────────────────────────────────────────
  const overdueTasks = useMemo(() => {
    return visibleTasks
      .filter(t => t.due_date && t.due_date.slice(0, 10) < selectedDate && t.status !== 'done')
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [visibleTasks, selectedDate])

  const dayTasksAll = tasksByDate[selectedDate] ?? []
  const dayTasks = hideDone ? dayTasksAll.filter(t => t.status !== 'done') : dayTasksAll

  const dayGroups = useMemo(() => {
    const groups = new Map<string, { name: string; color: string; tasks: Task[] }>()
    for (const t of dayTasks) {
      const key = t.board_id ?? 'none'
      if (!groups.has(key)) {
        groups.set(key, {
          name: t.board?.name ?? NO_BOARD_NAME,
          color: t.board?.color ?? NO_BOARD_COLOR,
          tasks: [],
        })
      }
      groups.get(key)!.tasks.push(t)
    }
    for (const g of groups.values()) g.tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    return Array.from(groups.values())
  }, [dayTasks])

  const doneCount = dayTasksAll.filter(t => t.status === 'done').length
  const totalCount = dayTasksAll.length

  // ── Pasek tygodnia ─────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const start = startOfWeek(parseDateKey(selectedDate))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [selectedDate])

  function shiftWeek(days: number) {
    const d = parseDateKey(selectedDate)
    d.setDate(d.getDate() + days)
    selectDate(toDateKey(d))
  }

  // ── Widok miesiąca ─────────────────────────────────────────────────────
  const { year, month: mo } = calMonth
  const monthCells = useMemo(() => {
    const firstDay = new Date(year, mo, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, mo + 1, 0).getDate()
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
    const cells: (number | null)[] = []
    for (let i = 0; i < totalCells; i++) {
      const day = i - startOffset + 1
      cells.push(day >= 1 && day <= daysInMonth ? day : null)
    }
    return cells
  }, [year, mo])

  function prevMonth() {
    setCalMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 })
  }
  function nextMonth() {
    setCalMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 })
  }

  // Kolory tablic obecnych w widoku — legenda budowana dynamicznie
  const boardsInView = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const t of visibleTasks) {
      const key = t.board_id ?? 'none'
      if (!map.has(key)) map.set(key, { name: t.board?.name ?? NO_BOARD_NAME, color: t.board?.color ?? NO_BOARD_COLOR })
    }
    return Array.from(map.values())
  }, [visibleTasks])

  const dateLabel = parseDateKey(selectedDate).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-limona-surface rounded">
          {(['day', 'month'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5',
                mode === m ? 'bg-limona-lime text-black' : 'text-limona-text-muted hover:text-limona-white',
              )}
            >
              {m === 'day' ? <CalendarIcon size={12} /> : <LayoutGrid size={12} />}
              {m === 'day' ? 'Dzień' : 'Miesiąc'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="limona-select text-xs py-1.5"
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
          >
            <option value="">Wszyscy</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-limona-text-muted cursor-pointer select-none">
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} className="accent-limona-lime" />
            Ukryj zrobione
          </label>
          {selectedDate !== todayKey && (
            <button onClick={goToday} className="limona-btn-sm text-xs">Dziś</button>
          )}
        </div>
      </div>

      {/* Pasek tygodnia — zawsze widoczny, szybka nawigacja dzień po dniu */}
      <div className="flex items-center gap-1">
        <button onClick={() => shiftWeek(-7)} className="p-1.5 text-limona-text-muted hover:text-limona-white rounded hover:bg-limona-surface-2 flex-shrink-0">
          <ChevronLeft size={16} />
        </button>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDays.map(d => {
            const key = toDateKey(d)
            const count = (tasksByDate[key] ?? []).filter(t => t.status !== 'done').length
            const isSelected = key === selectedDate
            const isToday = key === todayKey
            const isOverdueDay = key < todayKey && count > 0
            return (
              <button
                key={key}
                onClick={() => selectDate(key)}
                className={cn(
                  'rounded-lg py-2 px-1 text-center transition-all border',
                  isSelected ? 'bg-limona-lime/15 border-limona-lime' : 'border-transparent hover:bg-limona-surface-2',
                )}
              >
                <p className="text-[9px] uppercase tracking-wider text-limona-text-dim">{DAYS_PL[(d.getDay() + 6) % 7]}</p>
                <p className={cn(
                  'text-sm font-mono font-bold leading-tight',
                  isToday ? 'text-limona-lime' : 'text-limona-white',
                )}>
                  {d.getDate()}
                </p>
                {count > 0 && (
                  <span className={cn(
                    'inline-block mt-0.5 text-[9px] font-bold px-1.5 rounded-full leading-tight',
                    isOverdueDay ? 'bg-limona-red/20 text-limona-red' : 'bg-limona-border/50 text-limona-text-muted',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button onClick={() => shiftWeek(7)} className="p-1.5 text-limona-text-muted hover:text-limona-white rounded hover:bg-limona-surface-2 flex-shrink-0">
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="limona-card h-16 animate-pulse" />)}
        </div>
      ) : mode === 'day' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-bold text-lg text-limona-white capitalize">{dateLabel}</h3>
            <div className="flex items-center gap-3 flex-shrink-0">
              {totalCount > 0 && (
                <span className="text-xs text-limona-text-muted">
                  <span className="text-limona-green font-mono">{doneCount}</span>/{totalCount} zrobionych
                </span>
              )}
              {onQuickAddTask && (
                <button onClick={() => openQuickAdd(selectedDate)} className="limona-btn-sm text-xs flex items-center gap-1">
                  <Plus size={12} /> Zadanie
                </button>
              )}
            </div>
          </div>

          {/* Zaległe — zawsze na górze, niezależnie od wybranego dnia */}
          {overdueTasks.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-red">
                <AlertTriangle size={13} /> Zaległe ({overdueTasks.length})
              </p>
              <div className="space-y-1.5">
                {overdueTasks.map(t => (
                  <CalendarTaskRow key={t.id} task={t} onOpen={() => onOpenTask(t)} overdue />
                ))}
              </div>
            </div>
          )}

          {dayGroups.length === 0 ? (
            <div className="limona-card p-8 text-center text-limona-text-dim text-sm">
              Brak zadań z terminem na ten dzień
            </div>
          ) : (
            dayGroups.map(group => (
              <div key={group.name} className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-text-muted">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  {group.name}
                </p>
                <div className="space-y-1.5">
                  {group.tasks.map(t => (
                    <CalendarTaskRow key={t.id} task={t} onOpen={() => onOpenTask(t)} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 text-limona-text-muted hover:text-limona-white transition-colors rounded hover:bg-limona-surface-2">
              <ChevronLeft size={18} />
            </button>
            <h3 className="font-heading font-bold text-lg text-limona-white">{MONTHS_PL[mo]} {year}</h3>
            <button onClick={nextMonth} className="p-1.5 text-limona-text-muted hover:text-limona-white transition-colors rounded hover:bg-limona-surface-2">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS_PL.map(d => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider text-limona-text-dim py-1 font-bold">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[84px]" />
              const key = toDateKey(new Date(year, mo, day))
              const dTasks = tasksByDate[key] ?? []
              const isToday = key === todayKey
              const isSelected = key === selectedDate
              // Unikalne kolory tablic obecne tego dnia — max 4 kropki + licznik
              const dots = Array.from(new Set(dTasks.map(t => t.board?.color ?? NO_BOARD_COLOR))).slice(0, 4)
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDate(key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectDate(key) }}
                  className={cn(
                    'group relative min-h-[84px] rounded p-1.5 border transition-colors text-left cursor-pointer',
                    isSelected ? 'border-limona-lime bg-limona-lime/10'
                      : isToday ? 'border-limona-lime/50 bg-limona-lime/5' : 'border-limona-border/50 bg-limona-surface/30 hover:bg-limona-surface-2/50',
                  )}
                >
                  <div className={cn('text-xs font-mono mb-1 leading-none', isToday ? 'text-limona-lime font-bold' : 'text-limona-text-dim')}>
                    {day}
                  </div>
                  {dTasks.length > 0 && (
                    <>
                      <div className="flex gap-0.5 mb-1">
                        {dots.map((c, idx) => <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />)}
                      </div>
                      <p className="text-[10px] text-limona-text-muted font-mono">{dTasks.length} zad.</p>
                    </>
                  )}
                  {onQuickAddTask && (
                    <button
                      type="button"
                      onClick={e => openQuickAdd(key, e)}
                      title="Dodaj zadanie na ten dzień"
                      className="absolute top-1 right-1 p-0.5 rounded text-limona-text-dim opacity-0 group-hover:opacity-100 hover:text-limona-lime hover:bg-limona-surface-2 transition-all"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-limona-border/50">
        <div className="flex items-center gap-3">
          {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map(p => (
            <span key={p} className="flex items-center gap-1 text-[10px] text-limona-text-dim">
              <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[p])} />
              {PRIORITY_LABEL[p]}
            </span>
          ))}
        </div>
        {boardsInView.length > 0 && (
          <div className="flex items-center gap-3 pl-3 border-l border-limona-border/50 flex-wrap">
            {boardsInView.map(b => (
              <span key={b.name} className="flex items-center gap-1 text-[10px] text-limona-text-dim">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                {b.name}
              </span>
            ))}
          </div>
        )}
        <span className="flex items-center gap-1 text-[10px] text-limona-red pl-3 border-l border-limona-border/50">
          <AlertTriangle size={10} /> Przeterminowane
        </span>
      </div>

      {/* Szybkie dodanie zadania na dany dzień */}
      <Modal
        isOpen={!!quickAddDate}
        onClose={() => setQuickAddDate(null)}
        title={quickAddDate ? `Nowe zadanie — ${parseDateKey(quickAddDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}` : 'Nowe zadanie'}
        size="sm"
      >
        <form onSubmit={submitQuickAdd} className="space-y-4">
          <input
            autoFocus
            required
            className="limona-input w-full"
            placeholder="Tytuł zadania..."
            value={quickAddTitle}
            onChange={e => setQuickAddTitle(e.target.value)}
          />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setQuickAddDate(null)} className="limona-btn-outline">Anuluj</button>
            <button type="submit" disabled={quickAddSaving || !quickAddTitle.trim()} className="limona-btn disabled:opacity-50">
              {quickAddSaving ? 'Dodawanie...' : 'Dodaj zadanie'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function CalendarTaskRow({ task, onOpen, overdue }: { task: Task; onOpen: () => void; overdue?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'limona-card w-full text-left p-3 flex items-center gap-3 hover:border-limona-lime/30 transition-all',
        task.status === 'done' && 'opacity-50',
      )}
    >
      {task.status === 'done'
        ? <CheckCircle2 size={16} className="text-limona-green flex-shrink-0" />
        : <Circle size={16} className={cn('flex-shrink-0', overdue ? 'text-limona-red' : 'text-limona-text-dim')} />}

      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority])} />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', task.status === 'done' && 'line-through text-limona-text-muted')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {task.property && (
            <span className="flex items-center gap-1 text-[10px] text-limona-blue">
              <LinkIcon size={9} />{formatPropertyAddress(task.property)}
            </span>
          )}
          {task.property?.kontakt && (
            <span className="flex items-center gap-1 text-[10px] text-limona-lime">
              <BookUser size={9} />{task.property.kontakt.nazwa}
            </span>
          )}
          {task.board && (
            <span className="text-[10px] px-1.5 rounded-full" style={{ backgroundColor: `${task.board.color}25`, color: task.board.color }}>
              {task.board.name}
            </span>
          )}
        </div>
      </div>

      <Badge value={task.status} />

      {task.assignee && (
        <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size="sm" />
      )}
    </button>
  )
}
