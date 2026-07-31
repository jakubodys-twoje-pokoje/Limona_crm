// Status dłużnika — niezależny tor statusu strony sprzedającej/zadłużonej
export type StatusDluznika = 'brak' | 'analiza' | 'umowa' | 'dokumenty' | 'oferta_od_inwestora' | 'sprzedaz' | 'zrezygnowal'

// Status inwestora — niezależny tor statusu strony kupującej/inwestora
export type StatusInwestora = 'brak' | 'oferta_zakupu' | 'aneks_akceptacja' | 'oferta_dla_klienta' | 'zakup'

// Status danego inwestora (kontaktu) względem KONKRETNEJ nieruchomości
export type InvestorPropertyStatus = 'zainteresowany' | 'nie_zainteresowany' | 'problematyczny' | 'sukces'

export type DealType = 'zadluzony_ponizej' | 'zadluzony_powyzej'

export type PropertyType = 'mieszkanie' | 'dom' | 'grunt' | 'hala' | 'inne'

export interface PropertyLineItem {
  label: string
  value: number
}

export interface ChecklistItemState {
  checked: boolean
  checked_by: string | null
  checked_by_name: string | null
  checked_at: string | null
}

export type PropertyChecklist = Record<string, ChecklistItemState>

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type UserRole = 'admin' | 'kierownik_centrali' | 'manager' | 'user' | 'viewer'

// --- Etap 0: dane strukturalne z pracy kontaktowej + temperatura leada ---
export type TaskType = 'wizyta' | 'telefon' | 'inne'

export type ContactCategory =
  | 'spoldzielnia'
  | 'wspolnota'
  | 'posrednik_finansowy'
  | 'posrednik_kredytowy'
  | 'inny'

export type TaskOutcome =
  | 'zainteresowany'
  | 'oczekuje_na_materialy'
  | 'niezainteresowany'
  | 'brak_kontaktu'

export type RejectionReason = 'cena' | 'timing' | 'konkurencja' | 'brak_decyzyjnosci' | 'inny'

export type ThemePreference = 'dark' | 'light' | 'contrast'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  rejon: string | null
  rejon_lat: number | null
  rejon_lng: number | null
  theme_preference: ThemePreference
  created_at: string
}

export interface Property {
  id: string
  adres: string
  kod_pocztowy: string | null
  miasto: string | null
  phone: string | null
  property_type: PropertyType | null
  area_sqm: number | null
  value_per_sqm: number | null
  wartosc_realna: number | null
  total_debt: number
  debt_type: 'below_value' | 'above_value' | null
  creditor1_amount: number
  creditor2_amount: number
  creditor3_amount: number
  owner_coefficient: number
  zadluzenia: PropertyLineItem[]
  status_dluznika: StatusDluznika
  status_inwestora: StatusInwestora
  status_changed_at: string
  deal_type: DealType | null
  owner_name: string | null
  kw_number: string | null
  kw_dzial1_komentarz: string | null
  kw_dzial2_komentarz: string | null
  kw_dzial3_komentarz: string | null
  kw_dzial4_komentarz: string | null
  czynsz_miesieczny: number | null
  pokazywania_count: number
  decision: string | null
  notes: string | null
  zrodlo: string | null
  created_by: string | null
  assigned_to: string | null
  kontakt_id: string | null
  uklad: string | null
  pietro: number | null
  pietro_z_ilu: number | null
  rok_budowy: number | null
  balkon_metraz: number | null
  strony_swiata: string | null
  wycena_szacunkowa: number | null
  checklist: PropertyChecklist
  co_assignees: string[]
  lat: number | null
  lng: number | null
  /** Ustawione przy statusie „zrezygnował" — nieruchomość w archiwum (usuwana po 30 dniach) */
  archived_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  creator?: Profile
  assignee?: Profile
  co_assignee_profiles?: Profile[]
  kontakt?: Kontakt
}

export interface PropertyNegotiationNote {
  id: string
  property_id: string
  investor_id: string | null
  user_id: string | null
  content: string
  created_at: string
  updated_at?: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export interface PropertyInvestor {
  id: string
  property_id: string
  kontakt_id: string
  status: InvestorPropertyStatus
  offer_amount: number | null
  created_by: string | null
  created_at: string
  kontakt?: Kontakt
}

export interface Task {
  id: string
  property_id: string | null
  kontakt_id: string | null
  lead_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  task_type: TaskType | null
  contact_category: ContactCategory | null
  outcome: TaskOutcome | null
  rejection_reason: RejectionReason | null
  rejection_note: string | null
  due_date: string | null
  due_time: string | null
  /** Data realizacji — planowany dzień domknięcia/następnego kroku dla zadań „w trakcie" (odrębne od due_date) */
  realization_date: string | null
  assigned_to: string | null
  co_assignees: string[]
  board_id: string | null
  list_id: string | null
  position: number
  created_by: string | null
  completed_at: string | null
  property_stage: string | null
  recurrence_freq: RecurrenceFreq | null
  recurrence_interval: number
  recurrence_until: string | null
  recurrence_parent_id: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  kontakt?: Kontakt
  lead?: { id: string; name: string }
  assignee?: Profile
  creator?: Profile
  board?: Board
  list?: BoardList
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly'

export interface Board {
  id: string
  name: string
  color: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: Profile
  lists?: BoardList[]
}

export interface BoardList {
  id: string
  board_id: string
  name: string
  position: number
  tasks?: Task[]
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'assigned' | 'converted' | 'rejected'

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  location: string | null
  lat: number | null
  lng: number | null
  source: string | null
  notes: string | null
  status: LeadStatus
  temperature: LeadTemperature
  next_contact_at: string | null
  assigned_to: string | null
  property_id: string | null
  kontakt_id: string | null
  converted_at: string | null
  meta: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  assignee?: Profile
  creator?: Profile
}

export interface LeadComment {
  id: string
  lead_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export interface ActivityLog {
  id: string
  property_id: string | null
  task_id: string | null
  user_id: string | null
  action: string
  details: Record<string, unknown> | null
  created_at: string
  // Joined fields
  user?: Profile
  property?: Property
}

export interface Document {
  id: string
  property_id: string
  name: string
  file_url: string
  file_type: string | null
  stage: string | null
  uploaded_by: string | null
  created_at: string
  uploader?: { id: string; full_name: string; avatar_url: string | null }
}

export type KontaktTyp =
  | 'inwestor'
  | 'spoldzielnia'
  | 'wspolnota'
  | 'zarzadca'
  | 'komornik'
  | 'klient'

export const KONTAKT_TYP_LABELS: Record<KontaktTyp, string> = {
  inwestor: 'Inwestor',
  spoldzielnia: 'Spółdzielnia',
  wspolnota: 'Wspólnota',
  zarzadca: 'Zarządca',
  komornik: 'Komornik',
  klient: 'Klient',
}

export const KONTAKT_TYPY: KontaktTyp[] = [
  'inwestor',
  'spoldzielnia',
  'wspolnota',
  'zarzadca',
  'komornik',
  'klient',
]

// Map pin colors — one distinct color per contact type
export const KONTAKT_TYP_COLORS: Record<KontaktTyp, string> = {
  inwestor:    '#0d9488', // teal
  spoldzielnia:'#1d4ed8', // blue
  wspolnota:   '#0e7490', // cyan
  zarzadca:    '#c2410c', // burnt orange
  komornik:    '#dc2626', // red
  klient:      '#7c3aed', // violet
}

// Color used for numbered tour pins (overrides type color)
export const TOUR_PIN_COLOR = '#eab308' // yellow

export type KontaktRozmiar = 'mala' | 'srednia' | 'duza'

export const KONTAKT_ROZMIAR_LABELS: Record<KontaktRozmiar, string> = {
  mala: 'Mała',
  srednia: 'Średnia',
  duza: 'Duża',
}

export const KONTAKT_ROZMIARY: KontaktRozmiar[] = ['mala', 'srednia', 'duza']

// Poziom potencjału kontaktu (targetowanie)
export type KontaktPriorytet = 'A' | 'B' | 'C'

export const KONTAKT_PRIORYTET_LABELS: Record<KontaktPriorytet, string> = {
  A: 'A — Wysoki priorytet',
  B: 'B — Średni priorytet (podgrzewać)',
  C: 'C — Niski priorytet',
}

// Krótkie etykiety do plakietek w tabeli
export const KONTAKT_PRIORYTET_SHORT: Record<KontaktPriorytet, string> = {
  A: 'A · Wysoki',
  B: 'B · Średni',
  C: 'C · Niski',
}

export const KONTAKT_PRIORYTETY: KontaktPriorytet[] = ['A', 'B', 'C']

// Types that are spółdzielnia / wspólnota (mają zgody na ulotki/plakaty, operatora budowy)
export const TYPY_SPOLDZIELNIA = new Set<KontaktTyp>(['spoldzielnia', 'wspolnota'])

// Types that can have chec_wspolpracy → prowizja/umowa (polecają nieruchomości za prowizję)
export const TYPY_Z_PROWIZJA = new Set<KontaktTyp>(['zarzadca', 'komornik'])

export type WeekDay = 'poniedzialek' | 'wtorek' | 'sroda' | 'czwartek' | 'piatek' | 'sobota' | 'niedziela'

export const WEEK_DAYS: WeekDay[] = ['poniedzialek', 'wtorek', 'sroda', 'czwartek', 'piatek', 'sobota', 'niedziela']

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  poniedzialek: 'Poniedziałek',
  wtorek: 'Wtorek',
  sroda: 'Środa',
  czwartek: 'Czwartek',
  piatek: 'Piątek',
  sobota: 'Sobota',
  niedziela: 'Niedziela',
}

export const WEEK_DAY_SHORT: Record<WeekDay, string> = {
  poniedzialek: 'Pn',
  wtorek: 'Wt',
  sroda: 'Śr',
  czwartek: 'Czw',
  piatek: 'Pt',
  sobota: 'Sob',
  niedziela: 'Ndz',
}

// Godziny otwarcia per dzień, np. "9:00-17:00"; pusty/brak klucza = zamknięte
export type WeeklyHours = Partial<Record<WeekDay, string>>

export interface Kontakt {
  id: string
  typ: KontaktTyp
  nazwa: string
  wojewodztwo: string | null
  miasto: string | null
  ulica: string | null
  godziny_otwarcia: WeeklyHours
  telefon: string | null
  email: string | null
  opis: string | null
  nip: string | null
  krs: string | null
  www: string | null
  rozmiar: KontaktRozmiar | null
  zdjecia: string[]
  /** Poziom potencjału: A = wysoki, B = średni (podgrzewać), C = niski */
  priorytet: KontaktPriorytet | null
  /** Data ostatniej wizyty u kontrahenta */
  ostatnia_wizyta: string | null
  assigned_to: string | null
  oddzial: string | null
  created_by: string | null
  wizyta_osobista: boolean
  wyslany_mail_oferta: boolean
  zgoda_ulotki: boolean
  zgoda_plakat: boolean
  chec_wspolpracy: boolean
  niezainteresowani: boolean
  operator_budowy_zainteresowani: boolean
  ustalona_prowizja: string | null
  umowa_url: string | null
  lat: number | null
  lng: number | null
  created_at: string
  updated_at: string
  // Joined fields
  assignee?: Profile
  creator?: Profile
  komentarze?: KontaktKomentarz[]
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  is_lead: boolean
  created_at: string
  profile?: Profile
}

export interface Team {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  members?: TeamMember[]
}

export interface KontaktShare {
  id: string
  kontakt_id: string
  shared_with_user_id: string
  created_by: string | null
  created_at: string
  shared_with?: Profile
}

export interface KontaktKomentarz {
  id: string
  kontakt_id: string
  user_id: string | null
  content: string
  created_at: string
  updated_at?: string | null
  // Joined fields
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export interface PropertyComment {
  id: string
  property_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export interface LeadComment {
  id: string
  lead_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: { id: string; full_name: string; avatar_url: string | null }
}

export interface DailyReport {
  id: string
  user_id: string
  date: string
  content: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      properties: {
        Row: Property
        Insert: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'creator' | 'assignee'>
        Update: Partial<Omit<Property, 'id' | 'created_at' | 'updated_at' | 'creator' | 'assignee'>>
      }
      property_negotiation_notes: {
        Row: PropertyNegotiationNote
        Insert: Omit<PropertyNegotiationNote, 'id' | 'created_at' | 'user'>
        Update: Partial<Omit<PropertyNegotiationNote, 'id' | 'created_at' | 'user'>>
      }
      property_investors: {
        Row: PropertyInvestor
        Insert: Omit<PropertyInvestor, 'id' | 'created_at' | 'kontakt'>
        Update: Partial<Omit<PropertyInvestor, 'id' | 'created_at' | 'kontakt'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'property' | 'kontakt' | 'assignee' | 'creator'>
        Update: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'property' | 'kontakt' | 'assignee' | 'creator'>>
      }
      kontakt_shares: {
        Row: KontaktShare
        Insert: Omit<KontaktShare, 'id' | 'created_at' | 'shared_with'>
        Update: Partial<Omit<KontaktShare, 'id' | 'created_at' | 'shared_with'>>
      }
      activity_log: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at' | 'user' | 'property'>
        Update: Partial<Omit<ActivityLog, 'id' | 'created_at' | 'user' | 'property'>>
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'created_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at'>>
      }
    }
  }
}
