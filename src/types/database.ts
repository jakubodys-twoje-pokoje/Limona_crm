export type PropertyStatus =
  | 'new'
  | 'analysis'
  | 'offer_sent'
  | 'negotiation'
  | 'contract'
  | 'legal_cleanup'
  | 'sale'
  | 'completed'
  | 'rejected'

export type ContactType = 'posrednik' | 'prywatne'

export type PropertyType = 'mieszkanie' | 'dom' | 'grunt' | 'hala' | 'inne'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type UserRole = 'admin' | 'user' | 'viewer'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  created_at: string
}

export interface Property {
  id: string
  location: string
  trello_link: string | null
  phone: string | null
  contact_type: ContactType | null
  property_type: PropertyType | null
  area_sqm: number | null
  value_per_sqm: number | null
  rw: number | null
  total_debt: number
  debt_type: 'below_value' | 'above_value' | null
  creditor1_amount: number
  creditor2_amount: number
  creditor3_amount: number
  owner_coefficient: number
  commission_pct: number
  notary_fee: number
  manual_offer: number | null
  status: PropertyStatus
  decision: string | null
  notes: string | null
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  // Joined fields
  creator?: Profile
  assignee?: Profile
}

export interface Task {
  id: string
  property_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
  created_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  assignee?: Profile
  creator?: Profile
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
  uploaded_by: string | null
  created_at: string
}

export type KontaktTyp =
  | 'spoldzielnia'
  | 'wspolnota_zarzadca'
  | 'posrednik_nieruchomosci'
  | 'posrednik_finansowy'
  | 'kancelaria_spadkowa'
  | 'kancelaria_rozwodowa'
  | 'notariusz'
  | 'rzeczoznawca'

export const KONTAKT_TYP_LABELS: Record<KontaktTyp, string> = {
  spoldzielnia: 'Spółdzielnia',
  wspolnota_zarzadca: 'Wspólnota/Zarządca',
  posrednik_nieruchomosci: 'Pośrednik nieruchomości',
  posrednik_finansowy: 'Pośrednik finansowy',
  kancelaria_spadkowa: 'Kancelaria spadkowa',
  kancelaria_rozwodowa: 'Kancelaria rozwodowa',
  notariusz: 'Notariusz',
  rzeczoznawca: 'Rzeczoznawca',
}

export const KONTAKT_TYPY: KontaktTyp[] = [
  'spoldzielnia',
  'wspolnota_zarzadca',
  'posrednik_nieruchomosci',
  'posrednik_finansowy',
  'kancelaria_spadkowa',
  'kancelaria_rozwodowa',
  'notariusz',
  'rzeczoznawca',
]

// Types that are spółdzielnia / wspólnota (have building/flat counts + specific statuses)
export const TYPY_SPOLDZIELNIA = new Set<KontaktTyp>(['spoldzielnia', 'wspolnota_zarzadca'])

// Types that can have chec_wspolpracy → prowizja/umowa
export const TYPY_Z_PROWIZJA = new Set<KontaktTyp>([
  'posrednik_nieruchomosci',
  'posrednik_finansowy',
  'kancelaria_spadkowa',
  'kancelaria_rozwodowa',
  'notariusz',
  'rzeczoznawca',
])

export interface Kontakt {
  id: string
  typ: KontaktTyp
  nazwa: string
  wojewodztwo: string | null
  miasto: string | null
  ulica: string | null
  godziny_otwarcia: string | null
  telefon: string | null
  email: string | null
  opis: string | null
  assigned_to: string | null
  oddzial: string | null
  created_by: string | null
  liczba_budynkow: number | null
  liczba_mieszkan: number | null
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

export interface KontaktKomentarz {
  id: string
  kontakt_id: string
  user_id: string | null
  content: string
  created_at: string
  // Joined fields
  user?: { id: string; full_name: string; avatar_url: string | null }
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
        Insert: Omit<Property, 'id' | 'rw' | 'created_at' | 'updated_at' | 'creator' | 'assignee'>
        Update: Partial<Omit<Property, 'id' | 'rw' | 'created_at' | 'updated_at' | 'creator' | 'assignee'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'property' | 'assignee' | 'creator'>
        Update: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'property' | 'assignee' | 'creator'>>
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
