'use client'

import { useState } from 'react'

export interface EntityPickerItem {
  id: string
  label: string
  sublabel?: string | null
}

interface Props {
  label: string
  placeholder?: string
  items: EntityPickerItem[]
  value: string | null
  onChange: (id: string | null) => void
  /** Kolor zaznaczenia wybranej pozycji (klasa tailwind), np. text-limona-blue */
  accentClass?: string
}

/**
 * Pole tekstowe z podpowiedziami do wybierania rekordu z dużej listy
 * (nieruchomości, kontakty — prawie 2000 pozycji, dropdown odpada).
 * Wpisujesz fragment nazwy/miasta, klikasz podpowiedź — wybrane.
 */
export function EntityPicker({ label, placeholder, items, value, onChange, accentClass = 'text-limona-lime' }: Props) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)

  const selected = value ? items.find(i => i.id === value) : null
  const q = search.trim().toLowerCase()
  const matches = q.length >= 2
    ? items
        .filter(i => i.id !== value)
        .filter(i => i.label.toLowerCase().includes(q) || (i.sublabel || '').toLowerCase().includes(q))
        .slice(0, 8)
    : []

  return (
    <div>
      <label className="limona-label block mb-2">{label}</label>
      <div className="relative">
        <input
          className="limona-input"
          placeholder={placeholder || 'Zacznij pisać, aby wyszukać...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {focused && q.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-limona-surface border border-limona-border rounded-lg shadow-xl z-50">
            {matches.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-limona-text-dim">Brak wyników dla „{search.trim()}"</p>
            ) : matches.map(i => (
              <button
                key={i.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(i.id)
                  setSearch('')
                  setFocused(false)
                }}
                className="w-full px-3 py-2 text-left hover:bg-limona-surface-2 transition-colors"
              >
                <span className="block text-sm text-limona-text font-medium truncate">{i.label}</span>
                {i.sublabel && <span className="block text-[11px] text-limona-text-dim truncate">{i.sublabel}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <p className={`text-xs mt-1 ${accentClass}`}>
          {selected.label}{' '}
          <button type="button" className="text-limona-text-dim hover:text-limona-red ml-1" onClick={() => onChange(null)}>✕</button>
        </p>
      )}
    </div>
  )
}
