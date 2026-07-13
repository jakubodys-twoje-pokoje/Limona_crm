// Planowanie objazdu — pomocnicze funkcje geograficzne i porządkujące.
// Nie jest to pełny solver VRPTW (routing z twardymi oknami czasowymi) —
// to praktyczna heurystyka: stały punkt startowy, opcjonalne stałe godziny
// spotkań ("kotwice") które muszą zachować swoją kolejność w czasie, i
// wstawianie pozostałych przystanków tam, gdzie dokładają najmniej kilometrów.

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface RouteStop {
  id: string
  lat: number
  lng: number
  /** Stała godzina spotkania "HH:MM" — przystanek staje się "kotwicą" trasy */
  appointmentTime?: string | null
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Kolejność przystanków — kotwice (ze stałą godziną spotkania) zachowują
 * wzajemną kolejność czasową, a pozostałe przystanki wstawiane są tam,
 * gdzie najmniej wydłużają trasę (najtańsza wstawka względem sąsiednich
 * odcinków start→kotwica1→kotwica2→...→koniec).
 */
export function buildRouteOrder(
  stops: RouteStop[],
  startLat: number,
  startLng: number,
): string[] {
  const withCoords = stops.filter(s => s.lat != null && s.lng != null)
  const noCoords = stops.filter(s => s.lat == null || s.lng == null).map(s => s.id)

  const anchors = withCoords
    .filter(s => s.appointmentTime)
    .sort((a, b) => timeToMinutes(a.appointmentTime!) - timeToMinutes(b.appointmentTime!))
  const anchorIds = new Set(anchors.map(a => a.id))
  const free = withCoords.filter(s => !anchorIds.has(s.id))

  // Punkty graniczne segmentów: start, kotwica1, kotwica2, ..., (koniec = null)
  const boundaries: { point: { lat: number; lng: number } | null }[] = [
    { point: { lat: startLat, lng: startLng } },
    ...anchors.map(a => ({ point: { lat: a.lat, lng: a.lng } })),
  ]
  const segments: RouteStop[][] = boundaries.map(() => [])

  for (const stop of free) {
    let bestSeg = 0
    let bestCost = Infinity
    for (let i = 0; i < boundaries.length; i++) {
      const from = boundaries[i].point!
      const to = i + 1 < boundaries.length ? boundaries[i + 1].point : null
      const cost = to
        ? haversine(from.lat, from.lng, stop.lat, stop.lng) + haversine(stop.lat, stop.lng, to.lat, to.lng) - haversine(from.lat, from.lng, to.lat, to.lng)
        : haversine(from.lat, from.lng, stop.lat, stop.lng)
      if (cost < bestCost) { bestCost = cost; bestSeg = i }
    }
    segments[bestSeg].push(stop)
  }

  // W obrębie segmentu — najbliższy sąsiad od punktu startowego segmentu
  const orderedIds: string[] = []
  for (let i = 0; i < boundaries.length; i++) {
    let cur = boundaries[i].point!
    const remaining = [...segments[i]]
    while (remaining.length > 0) {
      let nearestIdx = 0
      let minDist = Infinity
      for (let j = 0; j < remaining.length; j++) {
        const d = haversine(cur.lat, cur.lng, remaining[j].lat, remaining[j].lng)
        if (d < minDist) { minDist = d; nearestIdx = j }
      }
      const [picked] = remaining.splice(nearestIdx, 1)
      orderedIds.push(picked.id)
      cur = { lat: picked.lat, lng: picked.lng }
    }
    if (i < anchors.length) orderedIds.push(anchors[i].id)
  }

  return [...orderedIds, ...noCoords]
}

export interface ArrivalEstimate {
  id: string
  arrivalMinutes: number
}

/**
 * Szacowane godziny przyjazdu do kolejnych przystanków, licząc od godziny
 * wyjazdu — do planowania czy zdążymy w godzinach otwarcia. Przybliżenie:
 * stała średnia prędkość + stały czas obsługi na przystanek (linia prosta,
 * nie faktyczna trasa drogowa — to szacunek pomocniczy, nie gwarancja).
 */
export function estimateArrivals(
  orderedStops: { id: string; lat: number | null; lng: number | null }[],
  startLat: number,
  startLng: number,
  departureMinutes: number,
  avgSpeedKmh = 35,
  serviceMinutes = 15,
): ArrivalEstimate[] {
  const result: ArrivalEstimate[] = []
  let curLat = startLat
  let curLng = startLng
  let clock = departureMinutes

  for (const stop of orderedStops) {
    if (stop.lat == null || stop.lng == null) { result.push({ id: stop.id, arrivalMinutes: clock }); continue }
    const distKm = haversine(curLat, curLng, stop.lat, stop.lng)
    const travelMin = (distKm / avgSpeedKmh) * 60
    clock += travelMin
    result.push({ id: stop.id, arrivalMinutes: clock })
    clock += serviceMinutes
    curLat = stop.lat
    curLng = stop.lng
  }
  return result
}

export function minutesToTimeLabel(mins: number): string {
  const clamped = Math.max(0, Math.round(mins)) % (24 * 60)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
