'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, X, Route, Navigation, Trash2, CheckSquare, Square, MapPin, ChevronUp, ChevronDown } from 'lucide-react'
import { useKontakty } from '@/hooks/useKontakty'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { Kontakt, KontaktTyp } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY, KONTAKT_TYP_COLORS, TOUR_PIN_COLOR } from '@/types/database'

const KontaktyMap = dynamic(() => import('@/components/kontakty/KontaktyMap'), { ssr: false })

// ─── Tour state helpers ─────────────────────────────────────────────────────

function tourKey(userId: string) { return `limona-tour-${userId}` }

function gmapsNav(k: Kontakt): string {
  if (k.lat && k.lng) return `https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lng}`
  const addr = [k.nazwa, k.ulica, k.miasto].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MapaPage() {
  const { user } = useAuth()
  const { kontakty, loading } = useKontakty()

  // Filters
  const [search,      setSearch]      = useState('')
  const [typFilter,   setTypFilter]   = useState('')
  const [fCoop,       setFCoop]       = useState(false)
  const [fNie,        setFNie]        = useState(false)
  const [fBezCoords,  setFBezCoords]  = useState(false)

  // Tour — starts empty; loaded from localStorage once user ID is known
  const [tourIds,       setTourIds]       = useState<string[]>([])
  const [tourUnchecked, setTourUnchecked] = useState<Set<string>>(new Set())
  const [tourMode,      setTourMode]      = useState(false)
  const [showPanel,     setShowPanel]     = useState(false)
  const [tourSearch,    setTourSearch]    = useState('')
  const [showLegend,    setShowLegend]    = useState(true)
  const tourLoadedRef = useRef(false)

  // Load per-user tour from localStorage
  useEffect(() => {
    if (!user?.id || tourLoadedRef.current) return
    tourLoadedRef.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(tourKey(user.id)) || '[]') as string[]
      setTourIds(saved)
    } catch { /* ignore */ }
  }, [user?.id])

  // Persist to per-user key (only after initial load)
  useEffect(() => {
    if (!user?.id || !tourLoadedRef.current) return
    localStorage.setItem(tourKey(user.id), JSON.stringify(tourIds))
  }, [tourIds, user?.id])

  // Derive full Kontakt objects for tour list (keeps data fresh)
  const tourList = useMemo(
    () => tourIds.map(id => kontakty.find(k => k.id === id)).filter((k): k is Kontakt => k !== undefined),
    [tourIds, kontakty],
  )

  // Standard filter
  const filtered = useMemo(() => {
    return kontakty.filter(k => {
      if (typFilter && k.typ !== typFilter) return false
      if (fCoop && !k.chec_wspolpracy)      return false
      if (fNie  && !k.niezainteresowani)    return false
      if (fBezCoords && k.lat !== null && k.lng !== null) return false
      if (search) {
        const q = search.toLowerCase()
        if (![k.nazwa, k.miasto, k.ulica, k.wojewodztwo].join(' ').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [kontakty, typFilter, fCoop, fNie, fBezCoords, search])

  // What the map actually displays
  const mapKontakty = useMemo(() => {
    if (!tourMode) return filtered
    return tourList.filter(k => !tourUnchecked.has(k.id))
  }, [tourMode, tourList, tourUnchecked, filtered])

  // Numbered pins for tour items
  const tourOrderMap = useMemo(() => {
    const m = new Map<string, number>()
    tourList.forEach((k, i) => m.set(k.id, i + 1))
    return m
  }, [tourList])

  // Tour search suggestions
  const tourSuggestions = useMemo(() => {
    if (!tourSearch.trim()) return []
    const q = tourSearch.toLowerCase()
    return kontakty
      .filter(k => !tourIds.includes(k.id))
      .filter(k => [k.nazwa, k.miasto, k.ulica].join(' ').toLowerCase().includes(q))
      .slice(0, 7)
  }, [kontakty, tourIds, tourSearch])

  // Multi-stop Google Maps URL
  const tourRouteUrl = useMemo(() => {
    const stops = tourList.filter(k => !tourUnchecked.has(k.id) && k.lat && k.lng)
    if (stops.length < 1) return null
    return `https://www.google.com/maps/dir/${stops.map(k => `${k.lat},${k.lng}`).join('/')}`
  }, [tourList, tourUnchecked])

  // ── Tour actions ──────────────────────────────────────────────────────────

  function addToTour(k: Kontakt) {
    if (tourIds.includes(k.id)) return
    if (tourIds.length === 0) setShowPanel(true)
    setTourIds(prev => [...prev, k.id])
  }

  function removeFromTour(id: string) {
    setTourIds(prev => prev.filter(i => i !== id))
    setTourUnchecked(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function toggleChecked(id: string) {
    setTourUnchecked(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function moveUp(id: string) {
    setTourIds(prev => {
      const i = prev.indexOf(id)
      if (i <= 0) return prev
      const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n
    })
  }

  function moveDown(id: string) {
    setTourIds(prev => {
      const i = prev.indexOf(id)
      if (i === -1 || i >= prev.length - 1) return prev
      const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n
    })
  }

  function clearTour() {
    setTourIds([])
    setTourUnchecked(new Set())
    setTourMode(false)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const withCoords    = filtered.filter(k => k.lat && k.lng).length
  const withoutCoords = filtered.filter(k => !k.lat || !k.lng).length
  const hasFilters    = search || typFilter || fCoop || fNie || fBezCoords

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 lg:-mt-8 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2.5 bg-limona-surface border-b border-limona-border flex-shrink-0 flex-wrap">
        <div className="mr-2 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-limona-lime font-bold">Baza kontaktów</span>
          <h1 className="text-base font-heading font-bold text-limona-white leading-none">Mapa</h1>
        </div>

        {/* Search */}
        <div className="relative w-48 flex-shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted pointer-events-none" />
          <input
            className="limona-input pl-8 text-sm py-1.5 w-full"
            placeholder="Szukaj…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-limona-text-dim hover:text-limona-white">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Type */}
        <select className="limona-input text-sm py-1.5 flex-shrink-0" value={typFilter} onChange={e => setTypFilter(e.target.value)}>
          <option value="">Wszystkie typy</option>
          {KONTAKT_TYPY.map(t => <option key={t} value={t}>{KONTAKT_TYP_LABELS[t as KontaktTyp]}</option>)}
        </select>

        {/* Quick toggles */}
        {([
          { label: 'Współpraca', val: fCoop, set: setFCoop, cls: 'lime' },
          { label: 'Niezaint.',  val: fNie,  set: setFNie,  cls: 'red'  },
          { label: 'Brak lok.',  val: fBezCoords, set: setFBezCoords, cls: 'yellow' },
        ] as const).map(({ label, val, set, cls }) => (
          <label key={label} className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none flex-shrink-0',
            val
              ? cls === 'lime'   ? 'border-limona-lime bg-limona-lime/10 text-limona-lime'
              : cls === 'red'    ? 'border-limona-red bg-limona-red/10 text-limona-red'
                                 : 'border-limona-yellow bg-limona-yellow/10 text-limona-yellow'
              : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}>
            <input type="checkbox" className="sr-only" checked={val} onChange={e => set(e.target.checked)} />
            {label}
          </label>
        ))}

        {hasFilters && (
          <button onClick={() => { setSearch(''); setTypFilter(''); setFCoop(false); setFNie(false); setFBezCoords(false) }}
            className="p-1.5 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0" title="Wyczyść filtry">
            <X size={14} />
          </button>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-limona-text-dim hidden lg:block">
            <span className="text-limona-lime font-medium">{withCoords}</span> na mapie
            {withoutCoords > 0 && <span className="ml-2 text-limona-yellow">{withoutCoords} bez lok.</span>}
          </span>

          {/* Tour mode active indicator */}
          {tourMode && (
            <button onClick={() => setTourMode(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-limona-yellow bg-limona-yellow/15 text-limona-yellow text-xs font-bold uppercase tracking-wider">
              <X size={11} /> Tylko objazd
            </button>
          )}

          {/* Tour panel toggle */}
          <button
            onClick={() => setShowPanel(p => !p)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition-all',
              showPanel
                ? 'bg-limona-yellow/15 border-limona-yellow text-limona-yellow'
                : 'border-limona-border text-limona-text-muted hover:border-limona-yellow hover:text-limona-yellow',
            )}
          >
            <Route size={13} />
            Objazd
            {tourList.length > 0 && (
              <span className="bg-limona-yellow text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {tourList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Map + panel ── */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-limona-bg">
            <div className="w-8 h-8 border-2 border-limona-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <KontaktyMap
            kontakty={mapKontakty}
            height="100%"
            tourOrder={tourOrderMap}
            onAddToTour={addToTour}
          />
        )}

        {/* ── Legend overlay ── */}
        <div className="absolute bottom-8 left-2 z-[999]">
          {showLegend ? (
            <div className="bg-limona-surface/95 backdrop-blur-sm border border-limona-border rounded-lg p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] uppercase tracking-widest text-limona-text-muted font-bold">Legenda</span>
                <button onClick={() => setShowLegend(false)} className="p-0.5 text-limona-text-dim hover:text-limona-white ml-4">
                  <X size={10} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {KONTAKT_TYPY.map(typ => (
                  <div key={typ} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: KONTAKT_TYP_COLORS[typ as KontaktTyp] }} />
                    <span className="text-[11px] text-limona-text leading-none whitespace-nowrap">{KONTAKT_TYP_LABELS[typ as KontaktTyp]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-limona-border flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 text-[7px] font-black text-black flex items-center justify-center leading-none" style={{ backgroundColor: TOUR_PIN_COLOR }}>1</span>
                <span className="text-[11px] text-limona-text">Objazd (numer = kolejność)</span>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowLegend(true)}
              className="bg-limona-surface/90 backdrop-blur-sm border border-limona-border rounded px-2.5 py-1.5 text-[11px] text-limona-text-muted hover:text-limona-white transition-colors shadow-lg">
              Legenda
            </button>
          )}
        </div>

        {/* ── Tour panel overlay ── */}
        {showPanel && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-limona-surface/97 backdrop-blur-sm border-l border-limona-border z-[1000] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-limona-border flex-shrink-0">
              <Route size={15} className="text-limona-yellow flex-shrink-0" />
              <span className="text-sm font-bold text-limona-white">Lista objazdów</span>
              {tourList.length > 0 && (
                <span className="bg-limona-yellow text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {tourList.length}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {tourList.length > 0 && (
                  <button onClick={clearTour} className="text-[10px] text-limona-text-dim hover:text-limona-red transition-colors px-1.5 py-1 uppercase tracking-wider">
                    Wyczyść
                  </button>
                )}
                <button onClick={() => setShowPanel(false)} className="p-1.5 text-limona-text-dim hover:text-limona-white">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Actions */}
            {tourList.length > 0 && (
              <div className="px-3 py-2.5 border-b border-limona-border flex-shrink-0 flex gap-2">
                <button
                  onClick={() => setTourMode(v => !v)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border text-xs font-bold uppercase tracking-wider transition-all',
                    tourMode
                      ? 'bg-limona-yellow/15 border-limona-yellow text-limona-yellow'
                      : 'border-limona-border text-limona-text-muted hover:border-limona-yellow hover:text-limona-yellow',
                  )}
                >
                  <MapPin size={12} />
                  {tourMode ? 'Pokaż wszystkie' : 'Tylko objazd'}
                </button>
                {tourRouteUrl && (
                  <a
                    href={tourRouteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Otwórz trasę w Google Maps"
                    className="flex items-center gap-1.5 px-3 py-2 rounded border border-limona-border text-xs font-bold uppercase tracking-wider text-limona-text-muted hover:border-blue-400 hover:text-blue-400 transition-all"
                  >
                    <Navigation size={12} />
                    Trasa
                  </a>
                )}
              </div>
            )}

            {/* Tour list */}
            <div className="flex-1 overflow-y-auto">
              {tourList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-limona-text-dim gap-2 px-6 text-center">
                  <Route size={28} className="opacity-30" />
                  <p className="text-sm font-medium">Lista pusta</p>
                  <p className="text-[11px] opacity-60 leading-relaxed">
                    Kliknij marker na mapie i wybierz „+ Objazd", albo wyszukaj kontakt poniżej.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-limona-border">
                  {tourList.map((k, i) => {
                    const checked = !tourUnchecked.has(k.id)
                    return (
                      <div key={k.id} className={cn('flex items-start gap-2 px-3 py-2.5 group transition-opacity', !checked && 'opacity-45')}>

                        {/* Checkbox */}
                        <button onClick={() => toggleChecked(k.id)} className="mt-0.5 flex-shrink-0">
                          {checked
                            ? <CheckSquare size={15} className="text-limona-lime" />
                            : <Square      size={15} className="text-limona-text-dim" />}
                        </button>

                        {/* Number + info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-limona-yellow w-5 flex-shrink-0">{i + 1}.</span>
                            <p className="text-xs font-semibold text-limona-white truncate">{k.nazwa}</p>
                          </div>
                          {(k.ulica || k.miasto) && (
                            <p className="text-[10px] text-limona-text-dim truncate pl-5 mt-0.5">
                              {[k.ulica, k.miasto].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>

                        {/* Hover actions */}
                        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveUp(k.id)} disabled={i === 0}
                            className="p-1 text-limona-text-dim hover:text-limona-white disabled:opacity-20 transition-colors">
                            <ChevronUp size={12} />
                          </button>
                          <button onClick={() => moveDown(k.id)} disabled={i === tourList.length - 1}
                            className="p-1 text-limona-text-dim hover:text-limona-white disabled:opacity-20 transition-colors">
                            <ChevronDown size={12} />
                          </button>
                          <a href={gmapsNav(k)} target="_blank" rel="noopener noreferrer"
                            className="p-1 text-limona-text-dim hover:text-blue-400 transition-colors" title="Nawiguj">
                            <Navigation size={12} />
                          </a>
                          <button onClick={() => removeFromTour(k.id)}
                            className="p-1 text-limona-text-dim hover:text-limona-red transition-colors" title="Usuń z listy">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Add contact search */}
            <div className="border-t border-limona-border flex-shrink-0 p-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted pointer-events-none" />
                <input
                  className="limona-input pl-8 text-xs py-2 w-full"
                  placeholder="Dodaj kontakt do objazdu…"
                  value={tourSearch}
                  onChange={e => setTourSearch(e.target.value)}
                />
                {tourSearch && (
                  <button onClick={() => setTourSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-limona-text-dim hover:text-limona-white">
                    <X size={12} />
                  </button>
                )}
              </div>
              {tourSuggestions.length > 0 && (
                <div className="mt-1.5 border border-limona-border rounded bg-limona-bg max-h-44 overflow-y-auto">
                  {tourSuggestions.map(k => (
                    <button
                      key={k.id}
                      onClick={() => { addToTour(k); setTourSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-limona-surface transition-colors border-b border-limona-border last:border-0"
                    >
                      <p className="text-xs font-medium text-limona-white truncate">{k.nazwa}</p>
                      {k.miasto && <p className="text-[10px] text-limona-text-dim truncate">{k.miasto}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
