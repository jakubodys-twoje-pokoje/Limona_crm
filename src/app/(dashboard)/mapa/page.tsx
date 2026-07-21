'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, X, Route, Navigation, Trash2, CheckSquare, Square, MapPin, ChevronUp, ChevronDown, Building2, Clock, AlertTriangle, Flame } from 'lucide-react'
import { useKontakty } from '@/hooks/useKontakty'
import { useProperties } from '@/hooks/useProperties'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPropertyAddress } from '@/lib/utils'
import { geocodeAddress } from '@/lib/geocode'
import { isOpenAt } from '@/lib/godziny'
import { buildRouteOrder, estimateArrivals, minutesToTimeLabel } from '@/lib/routePlanning'
import type { Kontakt, KontaktTyp, Lead } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY, TOUR_PIN_COLOR } from '@/types/database'
import { MAP_STATUS_HEX, MAP_STATUS_LABELS } from '@/lib/mapStatus'

const KontaktyMap = dynamic(() => import('@/components/kontakty/KontaktyMap'), { ssr: false })

// ─── Tour state helpers ─────────────────────────────────────────────────────

function tourKey(userId: string) { return `limona-tour-${userId}` }
function tourMetaKey(userId: string) { return `limona-tour-meta-${userId}` }

interface TourMeta {
  startAddress: string
  startLat: number | null
  startLng: number | null
  departureTime: string
  appointments: Record<string, string>
}

const EMPTY_TOUR_META: TourMeta = { startAddress: '', startLat: null, startLng: null, departureTime: '08:00', appointments: {} }

function gmapsNav(k: Kontakt): string {
  if (k.lat && k.lng) return `https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lng}`
  const addr = [k.nazwa, k.ulica, k.miasto].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MapaPage() {
  const { user, profile } = useAuth()
  const { kontakty, loading } = useKontakty()
  const { properties, loading: propertiesLoading } = useProperties()

  // Leady na mapie — widoczność filtruje serwer (rola/przypisanie)
  const [leads, setLeads] = useState<Lead[]>([])
  useEffect(() => {
    fetch('/api/leads').then(r => r.ok ? r.json() : []).then(setLeads).catch(() => {})
  }, [])

  // Filters
  const [search,        setSearch]        = useState('')
  const [typFilter,     setTypFilter]     = useState('')
  const [fCoop,         setFCoop]         = useState(false)
  const [fNie,          setFNie]          = useState(false)
  const [fBezCoords,    setFBezCoords]    = useState(false)
  const [showProperties, setShowProperties] = useState(true)
  const [showLeads, setShowLeads] = useState(true)

  // Tour — starts empty; loaded from localStorage once user ID is known
  const [tourIds,       setTourIds]       = useState<string[]>([])
  const [tourUnchecked, setTourUnchecked] = useState<Set<string>>(new Set())
  const [tourMode,      setTourMode]      = useState(false)
  const [showPanel,     setShowPanel]     = useState(false)
  const [tourSearch,    setTourSearch]    = useState('')
  const [showLegend,    setShowLegend]    = useState(true)
  const tourLoadedRef = useRef(false)

  // Punkt startowy objazdu, godzina wyjazdu, stałe godziny spotkań per kontakt
  const [tourMeta, setTourMeta] = useState<TourMeta>(EMPTY_TOUR_META)
  const [geocodingStart, setGeocodingStart] = useState(false)

  // Load per-user tour from localStorage
  useEffect(() => {
    if (!user?.id || tourLoadedRef.current) return
    tourLoadedRef.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(tourKey(user.id)) || '[]') as string[]
      setTourIds(saved)
    } catch { /* ignore */ }
    try {
      const savedMeta = JSON.parse(localStorage.getItem(tourMetaKey(user.id)) || 'null') as TourMeta | null
      if (savedMeta) setTourMeta({ ...EMPTY_TOUR_META, ...savedMeta })
    } catch { /* ignore */ }
  }, [user?.id])

  // Persist to per-user key (only after initial load)
  useEffect(() => {
    if (!user?.id || !tourLoadedRef.current) return
    localStorage.setItem(tourKey(user.id), JSON.stringify(tourIds))
  }, [tourIds, user?.id])

  useEffect(() => {
    if (!user?.id || !tourLoadedRef.current) return
    localStorage.setItem(tourMetaKey(user.id), JSON.stringify(tourMeta))
  }, [tourMeta, user?.id])

  async function handleGeocodeStart() {
    if (!tourMeta.startAddress.trim()) return
    setGeocodingStart(true)
    const coords = await geocodeAddress(null, tourMeta.startAddress.trim(), null)
    setGeocodingStart(false)
    if (coords) setTourMeta(m => ({ ...m, startLat: coords.lat, startLng: coords.lng }))
  }

  function setAppointment(kontaktId: string, time: string) {
    setTourMeta(m => {
      const appointments = { ...m.appointments }
      if (time) appointments[kontaktId] = time
      else delete appointments[kontaktId]
      return { ...m, appointments }
    })
  }

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

  // Nieruchomości na mapie — objazd dotyczy tylko kontaktów, więc w trybie
  // "tylko objazd" nieruchomości znikają (skupienie na trasie wizyt).
  const mapProperties = useMemo(() => {
    if (!showProperties || tourMode) return []
    if (!search) return properties
    const q = search.toLowerCase()
    return properties.filter(p => formatPropertyAddress(p).toLowerCase().includes(q))
  }, [properties, showProperties, tourMode, search])

  // Leady na mapie — aktywne (bez skonwertowanych/odrzuconych), poza trybem objazdu
  const mapLeads = useMemo(() => {
    if (!showLeads || tourMode) return []
    const active = leads.filter(l => l.status !== 'converted' && l.status !== 'rejected')
    if (!search) return active
    const q = search.toLowerCase()
    return active.filter(l => l.name.toLowerCase().includes(q) || l.location?.toLowerCase().includes(q))
  }, [leads, showLeads, tourMode, search])

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

  const [optimizing, setOptimizing] = useState(false)

  async function resolveStartCoords(): Promise<{ lat: number; lng: number } | null> {
    if (tourMeta.startLat != null && tourMeta.startLng != null) {
      return { lat: tourMeta.startLat, lng: tourMeta.startLng }
    }
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 4000, maximumAge: 60000 },
      )
    })
  }

  async function optimizeRoute() {
    if (tourList.length < 2) return
    setOptimizing(true)
    try {
      const withCoords = tourList.filter(k => k.lat && k.lng)
      if (withCoords.length < 2) { setOptimizing(false); return }
      const start = await resolveStartCoords()
      const startLat = start?.lat ?? withCoords[0].lat!
      const startLng = start?.lng ?? withCoords[0].lng!
      const sorted = buildRouteOrder(
        tourList.map(k => ({ id: k.id, lat: k.lat!, lng: k.lng!, appointmentTime: tourMeta.appointments[k.id] || null })),
        startLat,
        startLng,
      )
      setTourIds(sorted)
    } finally {
      setOptimizing(false)
    }
  }

  // Szacowane godziny przyjazdu wg aktualnej kolejności — do wykrywania kolizji z godzinami otwarcia
  const arrivalByKontaktId = useMemo(() => {
    const startLat = tourMeta.startLat ?? tourList.find(k => k.lat && k.lng)?.lat ?? null
    const startLng = tourMeta.startLng ?? tourList.find(k => k.lat && k.lng)?.lng ?? null
    if (startLat == null || startLng == null) return new Map<string, number>()
    const [h, m] = tourMeta.departureTime.split(':').map(Number)
    const departureMinutes = (h || 0) * 60 + (m || 0)
    const estimates = estimateArrivals(
      tourList.map(k => ({ id: k.id, lat: k.lat, lng: k.lng })),
      startLat, startLng, departureMinutes,
    )
    return new Map(estimates.map(e => [e.id, e.arrivalMinutes]))
  }, [tourList, tourMeta.startLat, tourMeta.startLng, tourMeta.departureTime])

  function arrivalWarning(k: Kontakt): string | null {
    const arrival = arrivalByKontaktId.get(k.id)
    if (arrival == null) return null
    const arrivalDate = new Date()
    arrivalDate.setHours(0, 0, 0, 0)
    arrivalDate.setMinutes(arrival)
    const open = isOpenAt(k.godziny_otwarcia, arrivalDate)
    if (open === false) return `Szacowany przyjazd ${minutesToTimeLabel(arrival)} — zamknięte o tej porze`
    return null
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const kontaktyWithCoords    = filtered.filter(k => k.lat && k.lng).length
  const kontaktyWithoutCoords = filtered.filter(k => !k.lat || !k.lng).length
  const propertiesWithCoords  = mapProperties.filter(p => p.lat && p.lng).length
  const withCoords    = kontaktyWithCoords + propertiesWithCoords
  const withoutCoords = kontaktyWithoutCoords + (showProperties ? properties.filter(p => !p.lat || !p.lng).length : 0)
  const hasFilters    = search || typFilter || fCoop || fNie || fBezCoords

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 lg:-mt-8 flex flex-col h-[calc(100dvh-120px)] lg:h-[calc(100vh-56px)]">

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

        {/* Properties visibility toggle */}
        <label className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none flex-shrink-0',
          showProperties
            ? 'border-limona-lime bg-limona-lime/10 text-limona-lime'
            : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
        )}>
          <input type="checkbox" className="sr-only" checked={showProperties} onChange={e => setShowProperties(e.target.checked)} />
          <Building2 size={12} />
          Nieruchomości
        </label>

        {/* Leads visibility toggle */}
        <label className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors whitespace-nowrap select-none flex-shrink-0',
          showLeads
            ? 'border-purple-400 bg-purple-400/10 text-purple-300'
            : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
        )}>
          <input type="checkbox" className="sr-only" checked={showLeads} onChange={e => setShowLeads(e.target.checked)} />
          <Flame size={12} />
          Leady
        </label>

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
        {loading || propertiesLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-limona-bg">
            <div className="w-8 h-8 border-2 border-limona-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <KontaktyMap
            kontakty={mapKontakty}
            properties={mapProperties}
            leads={mapLeads}
            height="100%"
            tourOrder={tourOrderMap}
            onAddToTour={addToTour}
            defaultCenter={profile?.rejon_lat && profile?.rejon_lng ? { lat: profile.rejon_lat, lng: profile.rejon_lng } : null}
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
              <p className="text-[9px] uppercase tracking-widest text-limona-text-dim font-bold mb-1.5">Kształt = rodzaj</p>
              <div className="flex items-center gap-4 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="18" viewBox="0 0 26 36"><path d="M13 2C7.477 2 3 6.477 3 12c0 9 10 22 10 22S23 21 23 12C23 6.477 18.523 2 13 2z" fill="#6b7280" /></svg>
                  <span className="text-[11px] text-limona-text leading-none">Kontakt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="18" viewBox="0 0 26 36"><path d="M13 1 L2 10.5 L2 21 L9 21 L13 34 L17 21 L24 21 L24 10.5 Z" fill="#6b7280" /></svg>
                  <span className="text-[11px] text-limona-text leading-none">Nieruchomość</span>
                </div>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-limona-text-dim font-bold mb-1.5">Kolor = status</p>
              <div className="space-y-1">
                {(Object.keys(MAP_STATUS_HEX) as (keyof typeof MAP_STATUS_HEX)[]).map(k => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MAP_STATUS_HEX[k] }} />
                    <span className="text-[11px] text-limona-text leading-none whitespace-nowrap">{MAP_STATUS_LABELS[k]}</span>
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
          <div className="absolute top-0 right-0 bottom-0 left-0 sm:left-auto sm:w-80 bg-limona-surface border-l border-limona-border z-[1000] flex flex-col shadow-2xl">

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
              <div className="px-3 py-2.5 border-b border-limona-border flex-shrink-0 space-y-2">
                <div className="flex gap-2">
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
                {tourList.filter(k => k.lat && k.lng).length >= 2 && (
                  <button
                    onClick={optimizeRoute}
                    disabled={optimizing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-limona-lime/40 text-xs font-bold uppercase tracking-wider text-limona-lime hover:border-limona-lime hover:bg-limona-lime/5 transition-all disabled:opacity-40"
                  >
                    <Route size={12} />
                    {optimizing ? 'Optymalizuję…' : 'Zoptymalizuj trasę'}
                  </button>
                )}

                {/* Punkt startowy + godzina wyjazdu — używane przy optymalizacji trasy i szacowaniu przyjazdów */}
                <div className="pt-2 border-t border-limona-border space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-limona-text-dim font-bold">Start objazdu</p>
                  <div className="flex gap-1.5">
                    <input
                      className="limona-input flex-1 text-xs py-1.5"
                      placeholder="Adres startowy (np. biuro)..."
                      value={tourMeta.startAddress}
                      onChange={e => setTourMeta(m => ({ ...m, startAddress: e.target.value, startLat: null, startLng: null }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleGeocodeStart() }}
                    />
                    <button
                      onClick={handleGeocodeStart}
                      disabled={geocodingStart || !tourMeta.startAddress.trim()}
                      className="px-2.5 py-1.5 rounded border border-limona-border text-[10px] uppercase tracking-wider text-limona-text-muted hover:border-limona-lime hover:text-limona-lime transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {geocodingStart ? '…' : (tourMeta.startLat != null ? '✓' : 'Ustaw')}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-limona-text-dim flex-shrink-0" />
                    <label className="text-[10px] text-limona-text-dim">Wyjazd o</label>
                    <input
                      type="time"
                      className="limona-input text-xs py-1 w-24"
                      value={tourMeta.departureTime}
                      onChange={e => setTourMeta(m => ({ ...m, departureTime: e.target.value }))}
                    />
                  </div>
                </div>
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
                          <div className="flex items-center gap-2 pl-5 mt-1 flex-wrap">
                            <label className="flex items-center gap-1 text-[9px] text-limona-text-dim" title="Stała godzina spotkania — trasa ją uwzględni przy optymalizacji">
                              <Clock size={9} />
                              <input
                                type="time"
                                value={tourMeta.appointments[k.id] || ''}
                                onChange={e => setAppointment(k.id, e.target.value)}
                                className="bg-transparent border border-limona-border rounded px-1 py-0.5 text-[9px] text-limona-text w-[62px]"
                              />
                            </label>
                            {arrivalByKontaktId.has(k.id) && (
                              <span className="text-[9px] text-limona-text-dim">
                                ~{minutesToTimeLabel(arrivalByKontaktId.get(k.id)!)}
                              </span>
                            )}
                            {arrivalWarning(k) && (
                              <span title={arrivalWarning(k)!} className="flex items-center gap-0.5 text-[9px] text-limona-yellow">
                                <AlertTriangle size={9} /> zamknięte
                              </span>
                            )}
                          </div>
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
