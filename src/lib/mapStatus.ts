import type { Kontakt, KontaktTyp, Property, PropertyStatus, PropertyType } from '@/types/database'

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

const PROPERTY_STATUS_GREEN = new Set<PropertyStatus>([
  'sale', 'completed', 'sprzedaz', 'zakonczona', 'wynajem', 'akt_nabycia',
])
const PROPERTY_STATUS_RED = new Set<PropertyStatus>(['rejected'])

export function getPropertyMapStatus(status: PropertyStatus): MapStatusColor {
  if (PROPERTY_STATUS_RED.has(status)) return 'red'
  if (PROPERTY_STATUS_GREEN.has(status)) return 'green'
  return 'yellow'
}

type KontaktStatusFlags = Pick<Kontakt, 'chec_wspolpracy' | 'niezainteresowani'>

export function getKontaktMapStatus(k: KontaktStatusFlags): MapStatusColor {
  if (k.niezainteresowani) return 'red'
  if (k.chec_wspolpracy) return 'green'
  return 'yellow'
}

export function getPropertyMapStatusColor(p: Pick<Property, 'status'>): string {
  return MAP_STATUS_HEX[getPropertyMapStatus(p.status)]
}

export function getKontaktMapStatusColor(k: KontaktStatusFlags): string {
  return MAP_STATUS_HEX[getKontaktMapStatus(k)]
}

// Monogramy renderowane wewnątrz pinów — kształt/glif = rodzaj (podtyp),
// obrys pinu = rodzaj (kontakt vs nieruchomość), kolor = status.
export const KONTAKT_TYP_SHORT: Record<KontaktTyp, string> = {
  spoldzielnia: 'SP',
  wspolnota_zarzadca: 'WZ',
  posrednik_nieruchomosci: 'PN',
  posrednik_finansowy: 'PF',
  kancelaria_spadkowa: 'KS',
  kancelaria_rozwodowa: 'KR',
  notariusz: 'NT',
  rzeczoznawca: 'RZ',
  komornik: 'KM',
  fundusz: 'FN',
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
