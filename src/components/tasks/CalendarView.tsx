'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, AlertTriangle,
  Link as LinkIcon, BookUser, CheckCircle2, Circle, Plus,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
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

const HOUR_HEIGHT = 48 // px na godzinę w siatce dnia
const SNAP_MIN = 30    // przyciąganie kliknięć/przeciągania do 30 min
const CHIP_H = 32
const CHIP_GAP = 3

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

// Poniedziałek jako pierwszy dzień tygodnia zawierającego `date`
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MIN) * SNAP_MIN
}

interface CalendarViewProps {
  /** Zadania ze WSZYSTKICH tablic — kalendarz nie zależy od wybranej zakładki kanbanu */
  tasks: Task[]
  loading: boolean
  profiles: Profile[]
  onOpenTask: (t: Task) => void
  /** Otwarcie pełnego formularza „Dodaj zadanie" z prefiltrowanym terminem/godziną */
  onRequestAdd?: (dueDateKey: string, dueTime: string | null) => void
  /** Przeciągnięcie zadania na inny dzień/godzinę */
  onMoveTask?: (taskId: string, dueDateKey: string, dueTime: string | null) => Promise<void>
}

export function CalendarView({ tasks, loading, onOpenTask, onRequestAdd, onMoveTask }: CalendarViewProps) {
  // Domyślnie 1 dzień (po kliknięciu w Terminarz), z opcją 3 dni i miesiąca
  const [mode, setMode] = useState<'day' | 'threeday' | 'month'>('day')
  const daysToShow = mode === 'threeday' ? 3 : 1
  const gridCols = `44px ${Array.from({ length: daysToShow }, () => '1fr').join(' ')}`
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [hideDone, setHideDone] = useState(false)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)

  function openQuickAdd(dateKey: string, time: string | null, e?: React.MouseEvent) {
    e?.stopPropagation()
    onRequestAdd?.(dateKey, time)
  }

  const todayKey = toDateKey(new Date())

  // Filtr po agencie stosowany jest na poziomie strony Terminarza — tu
  // pracujemy już na przefiltrowanej liście
  const visibleTasks = tasks

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
    // Z miesiąca wskakujemy w widok dzienny; widok 1/3 dni zostaje jaki był
    setMode(prev => prev === 'month' ? 'day' : prev)
  }

  function goToday() {
    selectDate(todayKey)
  }

  function shiftDays(n: number) {
    setSelectedDate(k => addDays(k, n))
  }

  // ── Widok dzienny (1 lub 3 dni) ─────────────────────────────────────────
  const visibleDays = useMemo(
    () => Array.from({ length: daysToShow }, (_, i) => addDays(selectedDate, i)),
    [selectedDate, daysToShow],
  )

  const overdueTasks = useMemo(() => {
    return visibleTasks
      .filter(t => t.due_date && t.due_date.slice(0, 10) < selectedDate && t.status !== 'done')
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [visibleTasks, selectedDate])

  function dayTasksFor(key: string): Task[] {
    const all = tasksByDate[key] ?? []
    return hideDone ? all.filter(t => t.status !== 'done') : all
  }

  // Auto-scroll do bieżącej godziny (albo 7:00, gdy poza widokiem) przy zmianie okna
  useEffect(() => {
    if (mode === 'month' || !gridScrollRef.current) return
    const now = new Date()
    const base = visibleDays.includes(todayKey) ? now.getHours() * 60 + now.getMinutes() : 7 * 60
    gridScrollRef.current.scrollTop = Math.max(0, (base / 60) * HOUR_HEIGHT - 140)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedDate])

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

  const rangeLabel = useMemo(() => {
    const first = parseDateKey(visibleDays[0])
    const last = parseDateKey(visibleDays[visibleDays.length - 1])
    // Jeden dzień — pełny opis z dniem tygodnia
    if (visibleDays.length === 1) {
      return first.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    const sameMonth = first.getMonth() === last.getMonth()
    const firstStr = first.toLocaleDateString('pl-PL', { day: 'numeric', month: sameMonth ? undefined : 'long' })
    const lastStr = last.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${firstStr} – ${lastStr}`
  }, [visibleDays])

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleDropAllDay(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    setDragOverSlot(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId && onMoveTask) await onMoveTask(taskId, dayKey, null)
  }

  async function handleDropGrid(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    setDragOverSlot(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId || !onMoveTask) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const mins = snapMinutes((offsetY / HOUR_HEIGHT) * 60)
    await onMoveTask(taskId, dayKey, minutesToTime(mins))
  }

  function handleGridClick(e: React.MouseEvent, dayKey: string) {
    if (!onRequestAdd) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const mins = snapMinutes((offsetY / HOUR_HEIGHT) * 60)
    openQuickAdd(dayKey, minutesToTime(mins))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-limona-surface rounded">
          {([
            ['day', '1 dzień'],
            ['threeday', '3 dni'],
            ['month', 'Miesiąc'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5',
                mode === m ? 'bg-limona-lime text-black' : 'text-limona-text-muted hover:text-limona-white',
              )}
            >
              {m === 'month' ? <LayoutGrid size={12} /> : <CalendarIcon size={12} />}
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            const isSelected = visibleDays.includes(key)
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
      ) : mode !== 'month' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftDays(-1)} className="p-1.5 text-limona-text-muted hover:text-limona-white transition-colors rounded hover:bg-limona-surface-2">
                <ChevronLeft size={16} />
              </button>
              <h3 className="font-heading font-bold text-base text-limona-white capitalize">{rangeLabel}</h3>
              <button onClick={() => shiftDays(1)} className="p-1.5 text-limona-text-muted hover:text-limona-white transition-colors rounded hover:bg-limona-surface-2">
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-xs text-limona-text-dim hidden sm:inline">Przeciągnij zadanie, by zmienić termin</span>
          </div>

          {/* Zaległe — zawsze widoczne, niezależnie od wybranego okna */}
          {overdueTasks.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-limona-red">
                <AlertTriangle size={13} /> Zaległe ({overdueTasks.length})
              </p>
              <div className="space-y-1.5">
                {overdueTasks.map(t => (
                  <CalendarTaskRow
                    key={t.id}
                    task={t}
                    onOpen={() => onOpenTask(t)}
                    overdue
                    draggable={!!onMoveTask}
                    onDragStart={e => handleDragStart(e, t)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Nagłówki dni + pasek "cały dzień" */}
          <div className="grid gap-0" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {visibleDays.map(dayKey => {
              const d = parseDateKey(dayKey)
              const isToday = dayKey === todayKey
              return (
                <div key={dayKey} className={cn('text-center rounded-t px-1 py-1 border-l-2 border-limona-border', isToday && 'bg-limona-lime/10')}>
                  <p className="text-[9px] uppercase tracking-wider text-limona-text-dim">{DAYS_PL[(d.getDay() + 6) % 7]}</p>
                  <p className={cn('text-sm font-mono font-bold', isToday ? 'text-limona-lime' : 'text-limona-white')}>
                    {d.getDate()} {MONTHS_PL[d.getMonth()].slice(0, 3)}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="grid gap-0" style={{ gridTemplateColumns: gridCols }}>
            <div className="text-[9px] text-limona-text-dim text-right pr-1 pt-1 uppercase tracking-wider">cały dzień</div>
            {visibleDays.map(dayKey => {
              const allDayTasks = dayTasksFor(dayKey).filter(t => !t.due_time)
              return (
                <div
                  key={dayKey}
                  onDragOver={e => { e.preventDefault(); setDragOverSlot(`all-${dayKey}`) }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={e => handleDropAllDay(e, dayKey)}
                  className={cn(
                    'min-h-[36px] border-l-2 p-1.5 space-y-1 transition-colors overflow-hidden',
                    dragOverSlot === `all-${dayKey}` ? 'border-limona-lime bg-limona-lime/5' : 'border-limona-border',
                  )}
                >
                  {allDayTasks.map(t => (
                    <MiniTaskChip
                      key={t.id}
                      task={t}
                      onOpen={() => onOpenTask(t)}
                      draggable={!!onMoveTask}
                      onDragStart={e => handleDragStart(e, t)}
                    />
                  ))}
                  {onRequestAdd && (
                    <button
                      type="button"
                      onClick={() => openQuickAdd(dayKey, null)}
                      className="w-full text-[9px] text-limona-text-dim hover:text-limona-lime text-center py-0.5 transition-colors"
                    >
                      + dodaj
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Siatka godzinowa — przewijalna, 3 kolumny dni */}
          <div ref={gridScrollRef} className="overflow-y-auto rounded border border-limona-border/50" style={{ maxHeight: 520 }}>
            <div className="grid gap-0 relative" style={{ gridTemplateColumns: gridCols, height: HOUR_HEIGHT * 24 }}>
              {/* Etykiety godzin */}
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-1 text-right text-[9px] text-limona-text-dim font-mono"
                    style={{ top: h * HOUR_HEIGHT - 6 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {visibleDays.map(dayKey => {
                const isToday = dayKey === todayKey
                const timedTasks = dayTasksFor(dayKey).filter(t => t.due_time)
                  .sort((a, b) => a.due_time!.localeCompare(b.due_time!))
                let lastBottom = -Infinity
                const positioned = timedTasks.map(t => {
                  let top = (timeToMinutes(t.due_time!.slice(0, 5)) / 60) * HOUR_HEIGHT
                  if (top < lastBottom) top = lastBottom
                  lastBottom = top + CHIP_H + CHIP_GAP
                  return { task: t, top }
                })
                const now = new Date()
                const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT

                return (
                  <div
                    key={dayKey}
                    onClick={e => handleGridClick(e, dayKey)}
                    onDragOver={e => { e.preventDefault(); setDragOverSlot(`grid-${dayKey}`) }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={e => handleDropGrid(e, dayKey)}
                    className={cn(
                      'relative border-l-2 border-limona-border cursor-crosshair transition-colors overflow-hidden',
                      dragOverSlot === `grid-${dayKey}` && 'bg-limona-lime/5',
                    )}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-limona-border/30" style={{ top: h * HOUR_HEIGHT }} />
                    ))}
                    {isToday && (
                      <div className="absolute left-0 right-0 border-t-2 border-limona-red z-20 pointer-events-none" style={{ top: nowTop }}>
                        <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-limona-red" />
                      </div>
                    )}
                    {positioned.map(({ task: t, top }) => (
                      <div key={t.id} className="absolute left-1 right-1" style={{ top }}>
                        <MiniTaskChip
                          task={t}
                          onOpen={() => onOpenTask(t)}
                          draggable={!!onMoveTask}
                          onDragStart={e => handleDragStart(e, t)}
                          showTime
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
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
                  {onRequestAdd && (
                    <button
                      type="button"
                      onClick={e => openQuickAdd(key, null, e)}
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
    </div>
  )
}

function MiniTaskChip({
  task, onOpen, draggable, onDragStart, showTime,
}: {
  task: Task
  onOpen: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  showTime?: boolean
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={e => { e.stopPropagation(); onOpen() }}
      title={task.title}
      style={{ height: showTime ? CHIP_H : undefined }}
      className={cn(
        'w-full flex items-center gap-1 px-1.5 rounded text-left bg-limona-surface-2 border border-limona-border/60 hover:border-limona-lime/50 transition-colors overflow-hidden',
        task.status === 'done' && 'opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority])} />
      {showTime && task.due_time && (
        <span className="text-[9px] font-mono text-limona-text-dim flex-shrink-0">{task.due_time.slice(0, 5)}</span>
      )}
      <span className={cn('text-[10px] truncate flex-1', task.status === 'done' && 'line-through text-limona-text-muted')}>
        {task.title}
      </span>
    </button>
  )
}

function CalendarTaskRow({
  task, onOpen, overdue, draggable, onDragStart,
}: {
  task: Task
  onOpen: () => void
  overdue?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        'limona-card w-full text-left p-3 flex items-center gap-3 hover:border-limona-lime/30 transition-all',
        task.status === 'done' && 'opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
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
          {(task.property?.kontakt || task.kontakt) && (
            <span className="flex items-center gap-1 text-[10px] text-limona-lime">
              <BookUser size={9} />{(task.property?.kontakt || task.kontakt)!.nazwa}
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
