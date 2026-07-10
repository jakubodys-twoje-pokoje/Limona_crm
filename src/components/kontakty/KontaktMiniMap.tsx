'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'

interface Props {
  lat: number | null
  lng: number | null
  nazwa: string
  kontaktId: string
  onGeocode?: (lat: number, lng: number) => void
}

export default function KontaktMiniMap({ lat, lng, nazwa, kontaktId, onGeocode }: Props) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapObj  = useRef<unknown>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return
    if (mapObj.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapObj.current as any).setView([lat, lng], 15)
      return
    }

    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as never)

      const map = L.map(mapRef.current!, { center: [lat, lng], zoom: 15, zoomControl: false, scrollWheelZoom: false })
      mapObj.current = map
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19 },
      ).addTo(map)

      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#BEFF00;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.8)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      L.marker([lat, lng], { icon }).addTo(map)
        .bindPopup(nazwa, { autoPan: false })
        .openPopup()

      // Kontener bywa zainicjowany, zanim otaczająca karta ustabilizuje swój
      // rozmiar (np. w trakcie ładowania danych powyżej) — bez tego Leaflet
      // liczy zły rozmiar i popup/zoom renderują się w złym miejscu.
      requestAnimationFrame(() => map.invalidateSize())
    })

    return () => {
      if (mapObj.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapObj.current as any).remove()
        mapObj.current = null
      }
    }
  }, [lat, lng, nazwa])

  async function handleGeocode() {
    setGeocoding(true)
    setError(null)
    try {
      const res = await fetch(`/api/kontakty/${kontaktId}/geocode`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Nie znaleziono adresu')
      } else {
        const { lat: newLat, lng: newLng } = await res.json()
        onGeocode?.(newLat, newLng)
      }
    } catch {
      setError('Błąd połączenia')
    }
    setGeocoding(false)
  }

  if (!lat || !lng) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center h-32 rounded border border-dashed border-limona-border bg-limona-bg text-limona-text-dim text-sm flex-col gap-2">
          <MapPin size={20} className="text-limona-text-dim" />
          <span>Brak lokalizacji</span>
        </div>
        <button
          onClick={handleGeocode}
          disabled={geocoding}
          className="flex items-center gap-2 text-xs text-limona-text-muted hover:text-limona-lime transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={geocoding ? 'animate-spin' : ''} />
          {geocoding ? 'Geokodowanie…' : 'Pobierz lokalizację z adresu'}
        </button>
        {error && <p className="text-xs text-limona-red">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="w-full rounded border border-limona-border isolate relative z-0" style={{ height: '340px' }} />
      <div className="flex items-center justify-between">
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-limona-text-muted hover:text-limona-lime transition-colors flex items-center gap-1"
        >
          <MapPin size={11} /> Otwórz w OSM
        </a>
        <button
          onClick={handleGeocode}
          disabled={geocoding}
          className="flex items-center gap-1.5 text-xs text-limona-text-dim hover:text-limona-text-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={geocoding ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </div>
      {error && <p className="text-xs text-limona-red">{error}</p>}
    </div>
  )
}
