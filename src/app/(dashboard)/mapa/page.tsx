'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Search, Filter, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useKontakty } from '@/hooks/useKontakty'
import { cn } from '@/lib/utils'
import type { KontaktTyp, Profile } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY } from '@/types/database'

const KontaktyMap = dynamic(() => import('@/components/kontakty/KontaktyMap'), { ssr: false })

export default function MapaPage() {
  const { kontakty, loading } = useKontakty()
  const [profiles, setProfiles]         = useState<Profile[]>([])
  const [search, setSearch]             = useState('')
  const [typFilter, setTypFilter]       = useState('')
  const [showFilters, setShowFilters]   = useState(false)
  const [fCoop, setFCoop]               = useState(false)
  const [fNie, setFNie]                 = useState(false)
  const [fBezCoords, setFBezCoords]     = useState(false)

  useEffect(() => {
    fetch('/api/profiles').then(r => r.ok ? r.json() : []).then(setProfiles)
  }, [])

  const filtered = useMemo(() => {
    return kontakty.filter(k => {
      if (typFilter && k.typ !== typFilter) return false
      if (fCoop && !k.chec_wspolpracy)    return false
      if (fNie  && !k.niezainteresowani)  return false
      if (fBezCoords && (k.lat !== null && k.lng !== null)) return false
      if (search) {
        const q   = search.toLowerCase()
        const hay = [k.nazwa, k.miasto, k.ulica, k.wojewodztwo].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [kontakty, typFilter, fCoop, fNie, fBezCoords, search])

  const withCoords    = filtered.filter(k => k.lat !== null && k.lng !== null).length
  const withoutCoords = filtered.filter(k => k.lat === null || k.lng === null).length

  return (
    // Negative margins escape the dashboard p-4 lg:p-8 container → full bleed
    <div className="-mx-4 lg:-mx-8 -mt-4 lg:-mt-8 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Slim top bar */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 bg-limona-surface border-b border-limona-border flex-shrink-0">
        <div>
          <span className="text-xs uppercase tracking-widest text-limona-lime font-bold">Baza kontaktów</span>
          <h1 className="text-lg font-heading font-bold text-limona-white leading-none">Mapa</h1>
        </div>

        <div className="flex-1 flex items-center gap-2 ml-4">
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted" />
            <input
              className="limona-input pl-8 text-sm py-1.5 w-full"
              placeholder="Szukaj…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Typ filter */}
          <select
            className="limona-input text-sm py-1.5 max-w-[200px]"
            value={typFilter}
            onChange={e => setTypFilter(e.target.value)}
          >
            <option value="">Wszystkie typy</option>
            {KONTAKT_TYPY.map(t => (
              <option key={t} value={t}>{KONTAKT_TYP_LABELS[t]}</option>
            ))}
          </select>

          {/* Quick toggles */}
          <label className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none',
            fCoop ? 'border-limona-lime bg-limona-lime/10 text-limona-lime' : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}>
            <input type="checkbox" className="sr-only" checked={fCoop} onChange={e => setFCoop(e.target.checked)} />
            Chęć współpracy
          </label>

          <label className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none',
            fNie ? 'border-limona-red bg-limona-red/10 text-limona-red' : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}>
            <input type="checkbox" className="sr-only" checked={fNie} onChange={e => setFNie(e.target.checked)} />
            Niezainteresowani
          </label>

          <label className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none',
            fBezCoords ? 'border-limona-yellow bg-limona-yellow/10 text-limona-yellow' : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}>
            <input type="checkbox" className="sr-only" checked={fBezCoords} onChange={e => setFBezCoords(e.target.checked)} />
            Brak lokalizacji
          </label>

          {(search || typFilter || fCoop || fNie || fBezCoords) && (
            <button
              onClick={() => { setSearch(''); setTypFilter(''); setFCoop(false); setFNie(false); setFBezCoords(false) }}
              className="p-1.5 text-limona-text-dim hover:text-limona-red transition-colors"
              title="Wyczyść filtry"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="ml-auto text-xs text-limona-text-dim whitespace-nowrap hidden lg:block">
          <span className="text-limona-lime font-medium">{withCoords}</span> na mapie
          {withoutCoords > 0 && <span className="ml-2 text-limona-yellow">{withoutCoords} bez lokalizacji</span>}
        </div>
      </div>

      {/* Map — fills remaining height */}
      <div className="flex-1 min-h-0">
        {!loading && (
          <KontaktyMap kontakty={filtered} height="100%" />
        )}
        {loading && (
          <div className="w-full h-full flex items-center justify-center bg-limona-bg">
            <div className="w-8 h-8 border-2 border-limona-lime border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
