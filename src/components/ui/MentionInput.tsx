'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import type { Profile, Task } from '@/types/database'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  profiles: Profile[]
  tasks?: Task[]
  placeholder?: string
  maxLength?: number
  className?: string
  onSubmit?: () => void
  multiline?: boolean
  rows?: number
  autoFocus?: boolean
}

interface Suggestion {
  kind: 'user' | 'task'
  id: string
  label: string
  sublabel?: string
  avatar?: { name: string; url?: string | null }
}

export function MentionInput({
  value, onChange, profiles, tasks = [], placeholder, maxLength,
  className, onSubmit, multiline = false, rows = 1, autoFocus,
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerStart, setTriggerStart] = useState<number | null>(null)
  const [triggerChar, setTriggerChar] = useState<'@' | '#' | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const closeSuggestions = useCallback(() => {
    setSuggestions([])
    setTriggerStart(null)
    setTriggerChar(null)
    setSelectedIndex(0)
  }, [])

  function computeSuggestions(newValue: string, cursorPos: number) {
    const textBefore = newValue.slice(0, cursorPos)
    const lastAt = textBefore.lastIndexOf('@')
    const lastHash = textBefore.lastIndexOf('#')
    const lastTriggerPos = Math.max(lastAt, lastHash)

    if (lastTriggerPos === -1) { closeSuggestions(); return }

    const charBefore = lastTriggerPos > 0 ? newValue[lastTriggerPos - 1] : ' '
    if (charBefore !== ' ' && charBefore !== '\n' && lastTriggerPos !== 0) {
      closeSuggestions(); return
    }

    const tChar = newValue[lastTriggerPos] as '@' | '#'
    const query = newValue.slice(lastTriggerPos + 1, cursorPos).toLowerCase()

    if (query.includes('\n') || query.length > 30) { closeSuggestions(); return }

    setTriggerStart(lastTriggerPos)
    setTriggerChar(tChar)

    let items: Suggestion[] = []
    if (tChar === '@') {
      items = profiles
        .filter(p => p.full_name.toLowerCase().includes(query))
        .slice(0, 8)
        .map(p => ({
          kind: 'user',
          id: p.id,
          label: p.full_name,
          sublabel: p.role,
          avatar: { name: p.full_name, url: p.avatar_url },
        }))
    } else {
      items = tasks
        .filter(t => t.title.toLowerCase().includes(query))
        .slice(0, 8)
        .map(t => ({
          kind: 'task',
          id: t.id,
          label: t.title,
          sublabel: t.status === 'done' ? 'Zrobione' : t.status === 'in_progress' ? 'W trakcie' : t.status === 'blocked' ? 'Zablokowane' : 'Do zrobienia',
        }))
    }

    setSuggestions(items)
    setSelectedIndex(0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const newValue = e.target.value
    onChange(newValue)
    const cursorPos = e.target.selectionStart || 0
    computeSuggestions(newValue, cursorPos)
  }

  function applySuggestion(suggestion: Suggestion) {
    if (triggerStart === null) return
    const el = inputRef.current
    if (!el) return

    const cursorPos = el.selectionStart || 0
    const before = value.slice(0, triggerStart)
    const after = value.slice(cursorPos)

    const insertName = suggestion.label.includes(' ')
      ? `${triggerChar}"${suggestion.label}" `
      : `${triggerChar}${suggestion.label} `

    const newValue = before + insertName + after
    onChange(newValue)
    closeSuggestions()

    setTimeout(() => {
      el.focus()
      const newPos = before.length + insertName.length
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySuggestion(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSuggestions()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && onSubmit && suggestions.length === 0) {
      e.preventDefault()
      onSubmit()
    }
  }

  useEffect(() => {
    if (dropdownRef.current && suggestions.length > 0) {
      const item = dropdownRef.current.children[selectedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, suggestions.length])

  const sharedProps = {
    ref: inputRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    maxLength,
    autoFocus,
  }

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...sharedProps} rows={rows} className={cn('limona-input resize-none', className)} />
      ) : (
        <input {...sharedProps} type="text" className={cn('limona-input', className)} />
      )}

      {suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-72 max-h-52 overflow-y-auto bg-limona-surface border border-limona-border rounded-lg shadow-xl z-50"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.kind}-${s.id}`}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                i === selectedIndex
                  ? 'bg-limona-lime/20 text-limona-white'
                  : 'text-limona-text hover:bg-limona-surface-2'
              )}
              onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {s.avatar && <Avatar name={s.avatar.name} url={s.avatar.url} size="sm" />}
              {s.kind === 'task' && (
                <span className="w-5 h-5 flex items-center justify-center text-limona-blue font-bold text-xs">#</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.label}</p>
                {s.sublabel && <p className="text-[10px] text-limona-text-dim">{s.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
