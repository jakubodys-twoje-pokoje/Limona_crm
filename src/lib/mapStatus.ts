import type { Kontakt, KontaktTyp, Property, PropertyType } from '@/types/database'

export type MapStatusColor = 'green' | 'yellow' | 'red'

// Zgodne z tokenami tailwind.config.ts (limona.green/yellow/red)
export const MAP_STATUS_HEX: Record<MapStatusColor, string> = {
  green: '#00E676',
  yellow: '#FFD600',
  red: '#FF3D3D',
}

export const MAP_STATUS_LABELS: Record<MapStatusColor, string> = {
  green: 'Współpraca / postęp',
  yellow: 'W toku',
  red: 'Odrzucone / niezainteresowani',
}

type PropertyStatusFlags = Pick<Property, 'status_dluznika' | 'status_inwestora'>

export function getPropertyMapStatus(p: PropertyStatusFlags): MapStatusColor {
  if (p.status_dluznika === 'sprzedaz' || p.status_inwestora === 'zakup') return 'green'
  return 'yellow'
}

type KontaktStatusFlags = Pick<Kontakt, 'chec_wspolpracy' | 'niezainteresowani'>

export function getKontaktMapStatus(k: KontaktStatusFlags): MapStatusColor {
  if (k.niezainteresowani) return 'red'
  if (k.chec_wspolpracy) return 'green'
  return 'yellow'
}

export function getPropertyMapStatusColor(p: PropertyStatusFlags): string {
  return MAP_STATUS_HEX[getPropertyMapStatus(p)]
}

export function getKontaktMapStatusColor(k: KontaktStatusFlags): string {
  return MAP_STATUS_HEX[getKontaktMapStatus(k)]
}

// Monogramy renderowane wewnątrz pinów — kształt/glif = rodzaj (podtyp),
// obrys pinu = rodzaj (kontakt vs nieruchomość), kolor = status.
export const KONTAKT_TYP_SHORT: Record<KontaktTyp, string> = {
  inwestor: 'IN',
  spoldzielnia: 'SP',
  wspolnota: 'WS',
  zarzadca: 'ZA',
  komornik: 'KM',
}

export const PROPERTY_TYPE_SHORT: Record<PropertyType, string> = {
  mieszkanie: 'M',
  dom: 'D',
  grunt: 'G',
  hala: 'H',
  inne: 'I',
}

export const PROPERTY_TYPE_MAP_LABELS: Record<PropertyType, string> = {
  mieszkanie: 'Mieszkanie',
  dom: 'Dom',
  grunt: 'Grunt',
  hala: 'Hala',
  inne: 'Inne',
}
