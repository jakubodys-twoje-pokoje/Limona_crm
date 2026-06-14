'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Kontakt, KontaktTyp } from '@/types/database'
import { KONTAKT_TYP_LABELS } from '@/types/database'

interface Props {
  kontakty: Kontakt[]
  height?: string
  tourOrder?: Map<string, number>
  onAddToTour?: (k: Kontakt) => void
}

// Teardrop pin SVG — tip at bottom center
function pinSvg(color: string, num?: number): string {
  const inner =
    num !== undefined
      ? `<text x="13" y="14" text-anchor="middle" dominant-baseline="middle" font-size="${num > 9 ? 7 : 9}" font-weight="800" fill="white" font-family="DM Sans,system-ui,sans-serif">${num}</text>`
      : `<circle cx="13" cy="12" r="4" fill="rgba(255,255,255,0.25)"/>`
  return (
    `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M13 2C7.477 2 3 6.477 3 12c0 9 10 22 10 22S23 21 23 12C23 6.477 18.523 2 13 2z" ` +
    `fill="${color}" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>` +
    inner +
    `</svg>`
  )
}

function markerColor(k: Kontakt): string {
  if (k.chec_wspolpracy)   return '#84cc16'
  if (k.niezainteresowani) return '#EF4444'
  return '#6b7280'
}

function gmapsNav(k: Kontakt): string {
  if (k.lat && k.lng) return `https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lng}`
  const addr = [k.nazwa, k.ulica, k.miasto].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

// Injected once into <head> — overrides Leaflet's default white popup style
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

export default function KontaktyMap({ kontakty, height = '560px', tourOrder, onAddToTour }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<unknown>(null)
  const lRef      = useRef<typeof import('leaflet') | null>(null)
  const onAddRef  = useRef(onAddToTour)
  const kontRef   = useRef(kontakty)

  useEffect(() => { onAddRef.current = onAddToTour }, [onAddToTour])
  useEffect(() => { kontRef.current  = kontakty   }, [kontakty])

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return

    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as never)
      lRef.current = L

      const withC = kontakty.filter(k => k.lat && k.lng)
      const center: [number, number] = withC.length > 0 ? [withC[0].lat!, withC[0].lng!] : [52.1, 19.4]

      const map = L.map(mapRef.current!, {
        center,
        zoom: withC.length > 0 ? 11 : 6,
        zoomControl: true,
      })
      mapObj.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Event delegation — handles "Dodaj do objazdu" button in popups
      mapRef.current!.addEventListener('click', (e: MouseEvent) => {
        const id = (e.target as HTMLElement).dataset.addTour
        if (!id) return
        const k = kontRef.current.find(c => c.id === id)
        if (k) onAddRef.current?.(k)
      })
    })

    return () => {
      if (mapObj.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapObj.current as any).remove()
        mapObj.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers whenever kontakty or tourOrder changes
  useEffect(() => {
    const L   = lRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapObj.current as any
    if (!L || !map) return

    // Remove existing markers
    map.eachLayer((layer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((layer as any) instanceof L.Marker) map.removeLayer(layer)
    })

    const withC = kontakty.filter(k => k.lat && k.lng)

    withC.forEach(k => {
      const num    = tourOrder?.get(k.id)
      const color  = num !== undefined ? '#f59e0b' : markerColor(k)
      const inTour = tourOrder?.has(k.id) ?? false

      const icon = L.divIcon({
        html:        pinSvg(color, num),
        className:   '',
        iconSize:    [26, 36],
        iconAnchor:  [13, 34],
        popupAnchor: [0, -36],
      })

      const addr = [k.ulica, k.miasto].filter(Boolean).join(', ')

      const popupHtml = `
        <div class="lm-p">
          <div class="lm-name">${k.nazwa}</div>
          ${k.typ ? `<div class="lm-sub">${KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ}</div>` : ''}
          ${addr ? `<div class="lm-sub">${addr}</div>` : ''}
          <div class="lm-actions">
            <a href="/kontakty/${k.id}" class="lm-btn lm-open">Otwórz →</a>
            <a href="${gmapsNav(k)}" target="_blank" rel="noopener noreferrer" class="lm-btn lm-nav">Nawiguj</a>
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

    if (withC.length > 1) {
      const bounds = L.latLngBounds(withC.map(k => [k.lat!, k.lng!]))
      map.fitBounds(bounds, { padding: [48, 48] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontakty, tourOrder])

  const isFullHeight = height === '100%'
  const withCoords   = kontakty.filter(k => k.lat && k.lng)

  const LEGEND_PIN = (color: string) =>
    `<svg width="10" height="14" viewBox="0 0 26 36"><path d="M13 2C7.477 2 3 6.477 3 12c0 9 10 22 10 22S23 21 23 12C23 6.477 18.523 2 13 2z" fill="${color}" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/></svg>`

  return (
    <>
      <style>{MAP_CSS}</style>
      <div className={isFullHeight ? 'flex flex-col h-full' : 'space-y-2'}>
        <div
          ref={mapRef}
          className={cn('w-full', isFullHeight ? 'flex-1 min-h-0' : 'rounded-lg border border-limona-border')}
          style={{ height: isFullHeight ? undefined : height }}
        />
        {!isFullHeight && (
          <div className="flex items-center gap-4 text-[11px] text-limona-text-dim flex-wrap">
            {[
              { color: '#84cc16', label: 'Chęć współpracy' },
              { color: '#EF4444', label: 'Niezainteresowani' },
              { color: '#6b7280', label: 'Pozostałe' },
              { color: '#f59e0b', label: 'W objeździe' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span dangerouslySetInnerHTML={{ __html: LEGEND_PIN(color) }} />
                {label}
              </span>
            ))}
            <span className="ml-auto">
              {withCoords.length} z {kontakty.length} kontaktów na mapie
            </span>
          </div>
        )}
      </div>
    </>
  )
}
