'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Kontakt, KontaktTyp } from '@/types/database'
import { KONTAKT_TYP_LABELS } from '@/types/database'

interface Props {
  kontakty: Kontakt[]
  height?: string
}

function markerColor(k: Kontakt): string {
  if (k.chec_wspolpracy)   return '#BEFF00'
  if (k.niezainteresowani) return '#FF3D3D'
  return '#808080'
}

export default function KontaktyMap({ kontakty, height = '560px' }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<unknown>(null)
  const router    = useRouter()

  const withCoords = kontakty.filter(k => k.lat !== null && k.lng !== null)

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return

    // Dynamic import to avoid SSR issues
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as never)

      const center: [number, number] = withCoords.length > 0
        ? [withCoords[0].lat!, withCoords[0].lng!]
        : [52.1, 19.4]

      const map = L.map(mapRef.current!, {
        center,
        zoom: withCoords.length > 0 ? 11 : 6,
        zoomControl: true,
      })
      mapObj.current = map

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      ).addTo(map)

      // Auto-fit bounds if multiple markers
      if (withCoords.length > 1) {
        const bounds = L.latLngBounds(withCoords.map(k => [k.lat!, k.lng!]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      withCoords.forEach(k => {
        const color = markerColor(k)
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.7);cursor:pointer"></div>`,
          className: '',
          iconSize:   [14, 14],
          iconAnchor: [7, 7],
          popupAnchor:[0, -12],
        })

        const popup = L.popup({ className: 'limona-map-popup' }).setContent(`
          <div style="font-family:DM Sans,sans-serif;min-width:160px;color:#e0e0e0;background:#141414;padding:0">
            <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:4px">${k.nazwa}</div>
            <div style="font-size:11px;color:#808080;margin-bottom:2px">${KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ}</div>
            ${k.miasto ? `<div style="font-size:11px;color:#808080">${[k.ulica, k.miasto].filter(Boolean).join(', ')}</div>` : ''}
            <div style="margin-top:8px">
              <a href="/kontakty/${k.id}" style="font-size:11px;color:#BEFF00;text-decoration:none;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Otwórz →</a>
            </div>
          </div>
        `)

        L.marker([k.lat!, k.lng!], { icon }).bindPopup(popup).addTo(map)
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

  // Re-render markers when kontakty change (filter updates)
  useEffect(() => {
    if (!mapObj.current) return
    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapObj.current as any
      map.eachLayer((layer: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((layer as any) instanceof L.Marker) map.removeLayer(layer)
      })

      withCoords.forEach(k => {
        const color = markerColor(k)
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.7);cursor:pointer"></div>`,
          className: '',
          iconSize:   [14, 14],
          iconAnchor: [7, 7],
          popupAnchor:[0, -12],
        })

        const popup = L.popup().setContent(`
          <div style="font-family:DM Sans,sans-serif;min-width:160px;color:#e0e0e0;background:#141414;padding:0">
            <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:4px">${k.nazwa}</div>
            <div style="font-size:11px;color:#808080;margin-bottom:2px">${KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ}</div>
            ${k.miasto ? `<div style="font-size:11px;color:#808080">${[k.ulica, k.miasto].filter(Boolean).join(', ')}</div>` : ''}
            <div style="margin-top:8px">
              <a href="/kontakty/${k.id}" style="font-size:11px;color:#BEFF00;text-decoration:none;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Otwórz →</a>
            </div>
          </div>
        `)

        L.marker([k.lat!, k.lng!], { icon }).bindPopup(popup).addTo(map)
      })

      if (withCoords.length > 1) {
        const bounds = L.latLngBounds(withCoords.map(k => [k.lat!, k.lng!]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })
  }, [kontakty]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFullHeight = height === '100%'

  return (
    <div className={isFullHeight ? 'flex flex-col h-full' : 'space-y-2'}>
      <div
        ref={mapRef}
        className={cn('w-full', isFullHeight ? 'flex-1 min-h-0' : 'rounded border border-limona-border')}
        style={{ height: isFullHeight ? undefined : height }}
      />
      {!isFullHeight && (
        <div className="flex items-center gap-4 text-[11px] text-limona-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-limona-lime inline-block" /> Chęć współpracy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-limona-red inline-block" /> Niezainteresowani
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#808080] inline-block" /> Brak danych
          </span>
          <span className="ml-auto">
            {withCoords.length} z {kontakty.length} kontaktów ma współrzędne
          </span>
        </div>
      )}
    </div>
  )
}
