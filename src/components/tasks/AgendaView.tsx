'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Plus, AlertTriangle, Repeat, Building2, BookUser, Clock,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn, formatPropertyAddress } from '@/lib/utils'
import type { Task, TaskPriority } from '@/types/database'

/**
 * Terminarz — mobilny widok zadań wzorowany na agendzie Google Calendar
 * (kompaktowy pasek tygodnia / rozwijany miesiąc + lista dniami) z kartami
 * zadań w duchu Trello (kolor priorytetu, chipy kontekstu, szybkie
 * odhaczanie). Domyślny widok kalendarza na telefonie.
 */

const DAYS_SHORT = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N']
const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

const PRIORITY_BAR: Record<TaskPriority, string> = {
  urgent: 'bg-limona-red',
  high: 'bg-orange-500',
  medium: 'bg-limona-blue',
  low: 'bg-limona-border',
}
const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDaysKey(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}
function startOfWeekKey(key: string): string {
  const d = parseDateKey(key)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return toDateKey(d)
}

function dayLabel(key: string, todayKey: string): string {
  const date = parseDateKey(key)
  const human = date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
  if (key === todayKey) return `Dziś · ${human}`
  if (key === addDaysKey(todayKey, 1)) return `Jutro · ${human}`
  return human.charAt(0).toUpperCase() + human.slice(1)
}

function sortDayTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const at = a.due_time ?? '99:99', bt = b.due_time ?? '99:99'
    if (at !== bt) return at < bt ? -1 : 1
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  })
}

interface AgendaViewProps {
  tasks: Task[]
  loading: boolean
  onOpenTask: (t: Task) => void
  onToggleDone: (t: Task) => Promise<void>
  /** Otwarcie pełnego formularza „Dodaj zadanie" z prefiltrowanym terminem */
  onRequestAdd: (dueDateKey: string, dueTime: string | null) => void
}

export function AgendaView({ tasks, loading, onOpenTask, onToggleDone, onRequestAdd }: AgendaViewProps) {
  const todayKey = toDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [monthExpanded, setMonthExpanded] = useState(false)
  const [showNoDate, setShowNoDate] = useState(false)
  const [showDone, setShowDone] = useState(true)
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Zadania per dzień (YYYY-MM-DD)
  const byDay = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of tasks) {
      if (!t.due_date) continue
      const key = t.due_date.slice(0, 10)
      ;(map[key] ??= []).push(t)
    }
    return map
  }, [tasks])

  const overdue = useMemo(
    () => sortDayTasks(tasks.filter(t => t.due_date && t.due_date.slice(0, 10) < todayKey && t.status !== 'done')),
    [tasks, todayKey]
  )
  const noDate = useMemo(
    () => tasks
      .filter(t => !t.due_date && t.status !== 'done')
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    [tasks]
  )

  // Sekcje dni: dziś + jutro zawsze, dalej tylko dni z zadaniami (30 dni w przód),
  // plus dzień wybrany w kalendarzyku (nawet pusty), żeby dało się do niego dodać zadanie
  const dayKeys = useMemo(() => {
    const keys = new Set<string>([todayKey, addDaysKey(todayKey, 1)])
    for (let i = 0; i <= 30; i++) {
      const key = addDaysKey(todayKey, i)
      if (byDay[key]?.length) keys.add(key)
    }
    if (selectedDate >= todayKey) keys.add(selectedDate)
    return [...keys].sort()
  }, [byDay, todayKey, selectedDate])

  // Klik dnia w pasku/miesiącu → przewiń agendę do sekcji tego dnia
  function selectDay(key: string) {
    setSelectedDate(key)
    setTimeout(() => {
      dayRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  // Pasek tygodnia (zwinięty) / siatka miesiąca (rozwinięta)
  const stripDays: string[] = useMemo(() => {
    if (!monthExpanded) {
      const start = startOfWeekKey(selectedDate)
      return [...Array(7)].map((_, i) => addDaysKey(start, i))
    }
    const d = parseDateKey(selectedDate)
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    const start = startOfWeekKey(toDateKey(first))
    return [...Array(42)].map((_, i) => addDaysKey(start, i))
  }, [selectedDate, monthExpanded])

  function shift(dir: -1 | 1) {
    if (monthExpanded) {
      const d = parseDateKey(selectedDate)
      const next = new Date(d.getFullYear(), d.getMonth() + dir, 1)
      setSelectedDate(toDateKey(next))
    } else {
      setSelectedDate(addDaysKey(selectedDate, dir * 7))
    }
  }

  const headerMonth = parseDateKey(selectedDate)

  useEffect(() => {
    // Wracając do terminarza zawsze pokazujemy dziś na wierzchu
    dayRefs.current[todayKey]?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function TaskRow({ task, showDate }: { task: Task; showDate?: boolean }) {
    const done = task.status === 'done'
    return (
      <div
        onClick={() => onOpenTask(task)}
        className={cn(
          'relative limona-card p-3 pl-4 cursor-pointer transition-colors overflow-hidden',
          'hover:border-limona-lime/40 active:bg-limona-surface-2',
          done && 'opacity-55'
        )}
      >
        {/* Pasek priorytetu (Trello-style) */}
        <span className={cn('absolute left-0 top-0 bottom-0 w-1', PRIORITY_BAR[task.priority])} />
        <div className="flex items-start gap-3">
          <button
            onClick={e => { e.stopPropagation(); onToggleDone(task) }}
            className={cn(
              'flex-shrink-0 mt-0.5 transition-colors',
              done ? 'text-limona-green' : 'text-limona-text-dim hover:text-limona-lime'
            )}
            title={done ? 'Cofnij wykonanie' : 'Oznacz jako zrobione'}
          >
            {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm leading-snug', done ? 'line-through text-limona-text-muted' : 'text-limona-text')}>
              {task.title}
            </p>
            <div className="flex items-center gap-x-2 gap-y-1 mt-1.5 flex-wrap">
              {showDate && task.due_date && (
                <span className="inline-flex items-center gap-1 text-[11px] text-limona-red font-medium">
                  <AlertTriangle size={10} />
                  {parseDateKey(task.due_date.slice(0, 10)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {task.due_time && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-limona-text-muted">
                  <Clock size={10} />{task.due_time.slice(0, 5)}
                </span>
              )}
              {task.recurrence_freq && (
                <span title="Zadanie cykliczne" className="text-limona-text-dim"><Repeat size={11} /></span>
              )}
              {task.property && (
                <span className="inline-flex items-center gap-1 text-[11px] text-limona-blue truncate max-w-[180px]">
                  <Building2 size={10} className="flex-shrink-0" />
                  <span className="truncate">{formatPropertyAddress(task.property)}</span>
                </span>
              )}
              {(task.kontakt || task.property?.kontakt) && (
                <span className="inline-flex items-center gap-1 text-[11px] text-limona-lime truncate max-w-[180px]">
                  <BookUser size={10} className="flex-shrink-0" />
                  <span className="truncate">{(task.kontakt || task.property?.kontakt)!.nazwa}</span>
                </span>
              )}
              {task.board && (
                <span className="inline-flex items-center gap-1 text-[11px] text-limona-text-dim">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.board.color }} />
                  {task.board.name}
                </span>
              )}
            </div>
          </div>
          {task.assignee && (
            <div className="flex-shrink-0" title={task.assignee.full_name}>
              <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size="sm" />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="limona-card h-16 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Nagłówek miesiąca + nawigacja */}
      <div className="limona-card p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shift(-1)} className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setMonthExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-limona-white uppercase tracking-wider"
          >
            {MONTHS_PL[headerMonth.getMonth()]} {headerMonth.getFullYear()}
            {monthExpanded ? <ChevronUp size={14} className="text-limona-text-dim" /> : <ChevronDown size={14} className="text-limona-text-dim" />}
          </button>
          <button onClick={() => shift(1)} className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Litery dni */}
        <div className="grid grid-cols-7 text-center mb-1">
          {DAYS_SHORT.map((d, i) => (
            <span key={i} className="text-[10px] text-limona-text-dim font-bold">{d}</span>
          ))}
        </div>

        {/* Pasek tygodnia lub siatka miesiąca */}
        <div className="grid grid-cols-7 gap-y-1">
          {stripDays.map(key => {
            const d = parseDateKey(key)
            const inMonth = !monthExpanded || d.getMonth() === headerMonth.getMonth()
            const dayTasks = byDay[key] ?? []
            const pending = dayTasks.filter(t => t.status !== 'done')
            const isToday = key === todayKey
            const isSelected = key === selectedDate
            return (
              <button
                key={key}
                onClick={() => selectDay(key)}
                className={cn('flex flex-col items-center gap-0.5 py-1 rounded transition-colors', !inMonth && 'opacity-30')}
              >
                <span className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors',
                  isSelected ? 'bg-limona-lime text-black font-bold'
                    : isToday ? 'border border-limona-lime text-limona-lime font-bold'
                    : 'text-limona-text hover:bg-limona-surface-2'
                )}>
                  {d.getDate()}
                </span>
                <span className="flex gap-0.5 h-1.5">
                  {sortDayTasks(pending).slice(0, 3).map(t => (
                    <span key={t.id} className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_BAR[t.priority])} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        {/* Przełącznik ukrywania zrobionych */}
        <div className="flex justify-end mt-1">
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-[11px] text-limona-text-dim hover:text-limona-text transition-colors"
          >
            {showDone ? 'Ukryj zrobione' : 'Pokaż zrobione'}
          </button>
        </div>
      </div>

      {/* Zaległe */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-limona-red">
            <AlertTriangle size={13} /> Zaległe ({overdue.length})
          </p>
          {overdue.map(t => <TaskRow key={t.id} task={t} showDate />)}
        </div>
      )}

      {/* Dni */}
      {dayKeys.map(key => {
        const dayTasks = sortDayTasks((byDay[key] ?? []).filter(t => showDone || t.status !== 'done'))
        return (
          <div key={key} ref={el => { dayRefs.current[key] = el }} className="space-y-2 scroll-mt-2">
            <div className="flex items-center justify-between">
              <p className={cn(
                'text-xs font-bold uppercase tracking-wider',
                key === todayKey ? 'text-limona-lime' : 'text-limona-text-muted'
              )}>
                {dayLabel(key, todayKey)}
              </p>
              <button
                onClick={() => onRequestAdd(key, null)}
                className="p-1 text-limona-text-dim hover:text-limona-lime transition-colors"
                title="Dodaj zadanie tego dnia"
              >
                <Plus size={15} />
              </button>
            </div>
            {dayTasks.length === 0 ? (
              <p className="text-xs text-limona-text-dim pl-1">Brak zadań</p>
            ) : (
              dayTasks.map(t => <TaskRow key={t.id} task={t} />)
            )}
          </div>
        )
      })}

      {/* Bez terminu */}
      {noDate.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowNoDate(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-text-muted hover:text-limona-text transition-colors"
          >
            {showNoDate ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Bez terminu ({noDate.length})
          </button>
          {showNoDate && noDate.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {/* FAB — szybkie dodanie na wybrany dzień */}
      <button
        onClick={() => onRequestAdd(selectedDate >= todayKey ? selectedDate : todayKey, null)}
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-40 w-14 h-14 rounded-full bg-limona-lime text-black shadow-lg shadow-black/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        title="Dodaj zadanie"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
