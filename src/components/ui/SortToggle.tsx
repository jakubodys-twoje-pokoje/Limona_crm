'use client'

import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
import type { SortDirection } from '@/lib/utils'

interface SortToggleProps {
  dir: SortDirection
  onToggle: () => void
}

/** Przełącznik kolejności komentarzy — 'desc' (najnowsze na górze) / 'asc' (najstarsze na górze). */
export function SortToggle({ dir, onToggle }: SortToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 text-[10px] text-limona-text-dim hover:text-limona-lime transition-colors uppercase tracking-wider"
      title="Zmień kolejność komentarzy"
    >
      {dir === 'desc' ? <ArrowDownNarrowWide size={11} /> : <ArrowUpNarrowWide size={11} />}
      {dir === 'desc' ? 'Najnowsze' : 'Najstarsze'}
    </button>
  )
}
