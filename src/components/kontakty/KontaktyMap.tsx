'use client'

import { useEffect, useRef, useState } from 'react'
import { cn, formatPropertyAddress } from '@/lib/utils'
import type { Kontakt, KontaktTyp, Lead, Property } from '@/types/database'
import { KONTAKT_TYP_LABELS, TOUR_PIN_COLOR } from '@/types/database'
import {
  getKontaktMapStatusColor, getPropertyMapStatusColor,
  KONTAKT_TYP_SHORT, PROPERTY_TYPE_SHORT, PROPERTY_TYPE_MAP_LABELS,
  MAP_STATUS_HEX,
} from '@/lib/mapStatus'

interface Props {
  kontakty: Kontakt[]
  properties?: Property[]
  leads?: Lead[]
  height?: string
  tourOrder?: Map<string, number>
  onAddToTour?: (k: Kontakt) => void
  /** Domyślny środek mapy (np. rejon użytkownika) — użyty zamiast pierwszego pinu, jeśli podany */
  defaultCenter?: { lat: number; lng: number } | null
}

// Kształt obrysu pinu koduje rodzaj (kontakt = łza, nieruchomość = domek);
// glif w środku doprecyzowuje podtyp; kolor wypełnienia koduje status.
function pinSvg(shape: 'drop' | 'house', color: string, glyph: string): string {
  const path = shape === 'drop'
    ? 'M13 2C7.477 2 3 6.477 3 12c0 9 10 22 10 22S23 21 23 12C23 6.477 18.523 2 13 2z'
    : 'M13 1 L2 10.5 L2 21 L9 21 L13 34 L17 21 L24 21 L24 10.5 Z'
  const fontSize = glyph.length > 1 ? 8 : 10
  const textY = shape === 'drop' ? 13 : 12
  const inner = `<text x="13" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="800" fill="white" font-family="DM Sans,system-ui,sans-serif">${glyph}</text>`
  return (
    `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${path}" fill="${color}" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linejoin="round"/>` +
    inner +
    `</svg>`
  )
}

// Nawigacja Google Maps — preferuje PEŁNY ADRES (Google sam go geokoduje,
// pokazuje czytelny cel i trasę), a współrzędne z Nominatim są tylko zapasem,
// gdy adresu brak. Adres jako destination w /dir/ zachowuje tryb „prowadź".
function gmapsNav(address: string | null | undefined, lat: number | null, lng: number | null): string {
  const q = (address || '').trim()
  if (q) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  return 'https://www.google.com/maps'
}

function kontaktGmapsNav(k: Kontakt): string {
  const addr = [k.ulica, k.miasto].filter(Boolean).join(', ')
  return gmapsNav(addr || k.nazwa, k.lat, k.lng)
}

function propertyGmapsNav(p: Property): string {
  return gmapsNav(formatPropertyAddress(p), p.lat, p.lng)
}

const MAP_CSS = `
.leaflet-popup-content-wrapper{background:#141414!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,0.65)!important;padding:0!important}
.leaflet-popup-content{margin:0!important;color:#e0e0e0!important;line-height:1.4!important}
.leaflet-popup-tip{background:#141414!important;box-shadow:none!important}
.leaflet-popup-close-button{color:#555!important;top:6px!important;right:6px!important;font-size:16px!important;width:20px!important;height:20px!important;line-height:20px!important}
.leaflet-popup-close-button:hover{color:#ccc!important;background:transparent!important}
.leaflet-control-zoom{border:1px solid rgba(0,0,0,0.15)!important;border-radius:8px!important;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)!important}
.leaflet-control-zoom a{background:#fff!important;color:#333!important;border-color:rgba(0,0,0,0.1)!important;width:32px!important;height:32px!important;line-height:32px!important;font-size:16px!important}
.leaflet-control-zoom a:hover{background:#f5f5f5!important}
.leaflet-attribution-flag{display:none!important}
.lm-p{padding:14px 18px 12px;min-width:210px}
.lm-name{font-weight:700;font-size:13px;color:#fff;margin-bottom:3px;padding-right:14px;line-height:1.3}
.lm-sub{font-size:11px;color:#6b7280;margin-bottom:1px;line-height:1.3}
.lm-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center}
.lm-btn{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;cursor:pointer;padding:4px 10px;border-radius:20px;border:none;line-height:1.4;white-space:nowrap}
.lm-btn:hover{opacity:0.75}
.lm-open{color:#84cc16;background:rgba(132,204,22,0.12)}
.lm-nav{color:#60a5fa;background:rgba(96,165,250,0.12)}
.lm-tour{color:#f59e0b;background:rgba(245,158,11,0.12)}
.lm-in-tour{color:#6b7280;background:transparent;cursor:default;font-size:10px}
`

const LEAD_PIN_COLOR = '#a855f7' // fiolet — odróżnia leady od kontaktów i nieruchomości

const LEAD_STATUS_MAP_LABELS: Record<string, string> = {
  new: 'Nowy', contacted: 'Po kontakcie', qualified: 'Zakwalifikowany',
  assigned: 'Przypisany', converted: 'Skonwertowany', rejected: 'Odrzucony',
}

function leadGmapsNav(l: Lead): string {
  // lead ma tylko wolny tekst `location` (pełny adres uzupełnia agent w CRM)
  return gmapsNav(l.location, l.lat, l.lng)
}

export default function KontaktyMap({ kontakty, properties = [], leads = [], height = '560px', tourOrder, onAddToTour, defaultCenter }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<unknown>(null)
  const onAddRef  = useRef(onAddToTour)
  const kontRef   = useRef(kontakty)
  const propRef   = useRef(properties)
  // fitBounds only on first render with markers — never on polling updates
  const fittedRef = useRef(false)
  // Set to true after Leaflet loads + map is ready; triggers the markers effect
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onAddRef.current = onAddToTour }, [onAddToTour])
  useEffect(() => { kontRef.current  = kontakty   }, [kontakty])
  useEffect(() => { propRef.current  = properties }, [properties])

  // ── Init map (runs once) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return

    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as never)

      const kWithC = kontRef.current.filter(k => k.lat && k.lng)
      const pWithC = propRef.current.filter(p => p.lat && p.lng)
      const first  = kWithC[0] ?? pWithC[0]
      const center: [number, number] = defaultCenter
        ? [defaultCenter.lat, defaultCenter.lng]
        : first ? [first.lat!, first.lng!] : [52.1, 19.4]

      const map = L.map(mapRef.current!, {
        center,
        zoom: defaultCenter ? 11 : first ? 11 : 6,
        zoomControl: true,
      })
      mapObj.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Event delegation for "Dodaj do objazdu" buttons inside popups
      mapRef.current!.addEventListener('click', (e: MouseEvent) => {
        const id = (e.target as HTMLElement).dataset.addTour
        if (!id) return
        const k = kontRef.current.find(c => c.id === id)
        if (k) onAddRef.current?.(k)
      })

      setMapReady(true) // signals markers effect to run
    })

    return () => {
      if (mapObj.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapObj.current as any).remove()
        mapObj.current = null
        fittedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render markers (runs when map is ready or data changes) ─────────────
  useEffect(() => {
    // Use import('leaflet') here — same pattern as original code.
    // This queues BEHIND the init import so it always gets a live `L` instance
    // regardless of whether the init has completed yet.
    if (!mapReady || !mapObj.current) return

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapObj.current as any
      if (!map) return

      // Remove existing markers (leave tile layer intact)
      map.eachLayer((layer: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((layer as any) instanceof L.Marker) map.removeLayer(layer)
      })

      const kWithC = kontakty.filter(k => k.lat && k.lng)
      const pWithC = properties.filter(p => p.lat && p.lng)
      const lWithC = leads.filter(l => l.lat && l.lng)

      kWithC.forEach(k => {
        const num    = tourOrder?.get(k.id)
        const color  = num !== undefined ? TOUR_PIN_COLOR : getKontaktMapStatusColor(k)
        const glyph  = num !== undefined ? String(num) : (KONTAKT_TYP_SHORT[k.typ as KontaktTyp] ?? '?')
        const inTour = tourOrder?.has(k.id) ?? false

        const icon = L.divIcon({
          html:        pinSvg('drop', color, glyph),
          className:   '',
          iconSize:    [26, 36],
          iconAnchor:  [13, 34],
          popupAnchor: [0, -36],
        })

        const addr = [k.ulica, k.miasto].filter(Boolean).join(', ')

        const popupHtml = `
          <div class="lm-p">
            <div class="lm-name">${k.nazwa}</div>
            ${k.typ ? `<div class="lm-sub">Kontakt · ${KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ}</div>` : ''}
            ${addr ? `<div class="lm-sub">${addr}</div>` : ''}
            <div class="lm-actions">
              <a href="/kontakty/${k.id}" class="lm-btn lm-open">Otwórz →</a>
              <a href="${kontaktGmapsNav(k)}" target="_blank" rel="noopener noreferrer" class="lm-btn lm-nav">Nawiguj</a>
              ${inTour
                ? `<span class="lm-in-tour">✓ W objeździe</span>`
                : `<button data-add-tour="${k.id}" class="lm-btn lm-tour">+ Objazd</button>`
              }
            </div>
          </div>`

        L.marker([k.lat!, k.lng!], { icon })
          .bindPopup(L.popup({ maxWidth: 300, className: '' }).setContent(popupHtml))
          .addTo(map)
      })

      pWithC.forEach(p => {
        const color = getPropertyMapStatusColor(p)
        const glyph = p.property_type ? PROPERTY_TYPE_SHORT[p.property_type] : '?'

        const icon = L.divIcon({
          html:        pinSvg('house', color, glyph),
          className:   '',
          iconSize:    [26, 36],
          iconAnchor:  [13, 34],
          popupAnchor: [0, -36],
        })

        const popupHtml = `
          <div class="lm-p">
            <div class="lm-name">${formatPropertyAddress(p)}</div>
            <div class="lm-sub">Nieruchomość${p.property_type ? ` · ${PROPERTY_TYPE_MAP_LABELS[p.property_type]}` : ''}</div>
            <div class="lm-actions">
              <a href="/nieruchomosci/${p.id}" class="lm-btn lm-open">Otwórz →</a>
              <a href="${propertyGmapsNav(p)}" target="_blank" rel="noopener noreferrer" class="lm-btn lm-nav">Nawiguj</a>
            </div>
          </div>`

        L.marker([p.lat!, p.lng!], { icon })
          .bindPopup(L.popup({ maxWidth: 300, className: '' }).setContent(popupHtml))
          .addTo(map)
      })

      lWithC.forEach(l => {
        const icon = L.divIcon({
          html:        pinSvg('drop', LEAD_PIN_COLOR, 'L'),
          className:   '',
          iconSize:    [26, 36],
          iconAnchor:  [13, 34],
          popupAnchor: [0, -36],
        })

        const popupHtml = `
          <div class="lm-p">
            <div class="lm-name">${l.name}</div>
            <div class="lm-sub">Lead · ${LEAD_STATUS_MAP_LABELS[l.status] || l.status}</div>
            ${l.location ? `<div class="lm-sub">${l.location}</div>` : ''}
            ${l.phone ? `<div class="lm-sub">${l.phone}</div>` : ''}
            <div class="lm-actions">
              <a href="/leady" class="lm-btn lm-open">Otwórz leady →</a>
              <a href="${leadGmapsNav(l)}" target="_blank" rel="noopener noreferrer" class="lm-btn lm-nav">Nawiguj</a>
            </div>
          </div>`

        L.marker([l.lat!, l.lng!], { icon })
          .bindPopup(L.popup({ maxWidth: 300, className: '' }).setContent(popupHtml))
          .addTo(map)
      })

      // fitBounds only on the first load with actual markers.
      // Never on subsequent updates (polling refresh, tour toggle, etc.)
      // — otherwise the map would fight the user's manual zoom every 30s.
      // Skipped entirely when defaultCenter (rejon użytkownika) is set —
      // mapa ma się otworzyć na rejonie, nie skakać do fit-all-pinów.
      const allWithC = [...kWithC.map(k => [k.lat!, k.lng!] as [number, number]), ...pWithC.map(p => [p.lat!, p.lng!] as [number, number])]
      if (allWithC.length > 1 && !fittedRef.current && !defaultCenter) {
        const bounds = L.latLngBounds(allWithC)
        map.fitBounds(bounds, { padding: [48, 48] })
        fittedRef.current = true
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, kontakty, properties, leads, tourOrder])

  const isFullHeight = height === '100%'
  const withCoords   = kontakty.filter(k => k.lat && k.lng).length + properties.filter(p => p.lat && p.lng).length
  const total        = kontakty.length + properties.length

  return (
    <>
      <style>{MAP_CSS}</style>
      <div className={isFullHeight ? 'flex flex-col h-full' : 'space-y-2'}>
        <div
          ref={mapRef}
          className={cn('w-full isolate relative z-0', isFullHeight ? 'flex-1 min-h-0' : 'rounded-lg border border-limona-border')}
          style={{ height: isFullHeight ? undefined : height }}
        />
        {!isFullHeight && (
          <div className="flex items-center gap-3 text-[11px] text-limona-text-dim flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MAP_STATUS_HEX.green }} /> Postęp/współpraca
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MAP_STATUS_HEX.yellow }} /> W toku
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MAP_STATUS_HEX.red }} /> Odrzucone
            </span>
            <span className="ml-auto">
              {withCoords} z {total} na mapie
            </span>
          </div>
        )}
      </div>
    </>
  )
}
