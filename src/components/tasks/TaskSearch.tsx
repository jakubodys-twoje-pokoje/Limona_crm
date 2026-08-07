'use client'

import { Search, X, CheckCircle2, Circle, Clock, Building2, BookUser, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPropertyAddress } from '@/lib/utils'
import type { Task } from '@/types/database'

/** Czy zadanie pasuje do frazy — tytuł, opis, powiązana nieruchomość/kontakt/lead */
export function taskMatchesQuery(t: Task, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return false
  return !!(
    t.title?.toLowerCase().includes(s)
    || t.description?.toLowerCase().includes(s)
    || (t.property && formatPropertyAddress(t.property).toLowerCase().includes(s))
    || t.kontakt?.nazwa?.toLowerCase().includes(s)
    || t.lead?.name?.toLowerCase().includes(s)
  )
}

/** Filtruje i sortuje zadania wg frazy — najświeższe terminy u góry, bez terminu na końcu */
export function searchTasks(tasks: Task[], q: string): Task[] {
  if (!q.trim()) return []
  return tasks
    .filter(t => taskMatchesQuery(t, q))
    .sort((a, b) => {
      const ad = a.due_date ?? '', bd = b.due_date ?? ''
      if (ad !== bd) return ad < bd ? 1 : -1
      return a.created_at < b.created_at ? 1 : -1
    })
}

export function TaskSearchBar({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted pointer-events-none" />
      <input
        className="limona-input w-full pl-9 pr-9 text-sm py-2.5"
        placeholder={placeholder ?? 'Szukaj we wszystkich zadaniach — nazwa, numer telefonu, nieruchomość, kontakt...'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange('')} title="Wyczyść"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-limona-text-dim hover:text-limona-white transition-colors">
          <X size={15} />
        </button>
      )}
    </div>
  )
}

export function TaskSearchResults({ results, query, onOpen }: {
  results: Task[]
  query: string
  onOpen: (t: Task) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-limona-text-muted">Znaleziono: {results.length}</p>
      {results.length === 0 ? (
        <p className="text-center text-limona-text-dim py-10 limona-card">Brak zadań pasujących do „{query.trim()}”</p>
      ) : (
        results.map(task => (
          <button key={task.id} onClick={() => onOpen(task)}
            className="w-full text-left limona-card p-3 flex items-center gap-3 hover:border-limona-lime/40 transition-colors">
            {task.status === 'done'
              ? <CheckCircle2 size={18} className="text-limona-green flex-shrink-0" />
              : <Circle size={18} className="text-limona-text-dim flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm', task.status === 'done' ? 'line-through text-limona-text-muted' : 'text-limona-text')}>
                {task.title}
              </p>
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-0.5 text-[11px] text-limona-text-dim">
                {task.due_date ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(task.due_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                  </span>
                ) : <span className="italic">Bez terminu</span>}
                {task.property && (
                  <span className="inline-flex items-center gap-1 text-limona-blue truncate max-w-[220px]">
                    <Building2 size={10} className="flex-shrink-0" /><span className="truncate">{formatPropertyAddress(task.property)}</span>
                  </span>
                )}
                {task.kontakt && (
                  <span className="inline-flex items-center gap-1 text-limona-lime truncate max-w-[220px]">
                    <BookUser size={10} className="flex-shrink-0" /><span className="truncate">{task.kontakt.nazwa}</span>
                  </span>
                )}
                {task.lead && (
                  <span className="inline-flex items-center gap-1 text-limona-lime truncate max-w-[220px]">
                    <Inbox size={10} className="flex-shrink-0" /><span className="truncate">{task.lead.name}</span>
                  </span>
                )}
              </div>
            </div>
            <Badge value={task.priority} />
          </button>
        ))
      )}
    </div>
  )
}
