'use client'

import { useState, useEffect, useRef } from 'react'
import { Link as LinkIcon, X, Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { EntityPicker, type EntityPickerItem } from '@/components/shared/EntityPicker'
import { TASK_TYPE_LABELS, CONTACT_CATEGORY_LABELS } from '@/lib/reports'
import { TASK_KINDS, TASK_KIND_LABELS } from '@/lib/legal-tasks'
import { formatPropertyAddress } from '@/lib/utils'
import { KONTAKT_TYP_LABELS } from '@/types/database'
import type {
  Task, TaskStatus, TaskPriority, TaskType, TaskKind, ContactCategory, Profile,
  RecurrenceFreq, KontaktTyp,
} from '@/types/database'

export interface TaskFormData {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
  due_time: string
  status: TaskStatus
  assigned_to: string
  co_assignees: string[]
  task_kind: TaskKind
  task_type: TaskType | ''
  contact_category: ContactCategory | ''
  recurrence_freq: RecurrenceFreq | ''
  recurrence_interval: number
  recurrence_until: string
  property_id: string | null
  kontakt_id: string | null
  lead_id: string | null
}

export const EMPTY_TASK_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  due_time: '',
  status: 'todo',
  assigned_to: '',
  co_assignees: [],
  task_kind: 'zwykle',
  task_type: '',
  contact_category: '',
  recurrence_freq: '',
  recurrence_interval: 1,
  recurrence_until: '',
  property_id: null,
  kontakt_id: null,
  lead_id: null,
}

// Gotowe opcje powtarzania (freq + interwał) — czytelne dla nietechnicznych
const RECURRENCE_PRESETS: { value: string; label: string; freq: RecurrenceFreq | ''; interval: number }[] = [
  { value: '', label: 'Nie powtarzaj', freq: '', interval: 1 },
  { value: 'daily:1', label: 'Codziennie', freq: 'daily', interval: 1 },
  { value: 'weekly:1', label: 'Co tydzień', freq: 'weekly', interval: 1 },
  { value: 'weekly:2', label: 'Co 2 tygodnie', freq: 'weekly', interval: 2 },
  { value: 'weekly:3', label: 'Co 3 tygodnie', freq: 'weekly', interval: 3 },
  { value: 'weekly:4', label: 'Co 4 tygodnie', freq: 'weekly', interval: 4 },
  { value: 'monthly:1', label: 'Co miesiąc', freq: 'monthly', interval: 1 },
]

interface TaskFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Zwraca { error } — modal zamyka się i resetuje po sukcesie */
  onCreate: (data: Partial<Task>) => Promise<{ error?: string | null } | void>
  userId: string
  /** Może przypisać zadanie innej osobie (kierownik/admin) */
  canAssign: boolean
  profiles: Profile[]
  /** Wartości startowe (status, termin, powiązania, board_id/list_id itp.) */
  defaults?: Partial<TaskFormData> & { board_id?: string | null; list_id?: string | null }
  /** Może zakładać zadania prawne (centrala) — bez tego formularz tworzy tylko zadania zwykłe */
  canCreateLegal?: boolean
  /** Rodzaj zadania ustalony przez kontekst (zakładka Zadania prawne) — pole tylko do odczytu */
  lockedKind?: boolean
  /** Ukryj wybór nieruchomości (karta nieruchomości) i pokaż powiązanie jako stałe */
  lockedPropertyLabel?: string
  /** Ukryj wybór kontaktu (karta spółdzielni/kontaktu) i pokaż powiązanie jako stałe */
  lockedKontaktLabel?: string
  /** Zadanie tworzone z karty leada — pokazuje leada jako stałe powiązanie, bez pickerów */
  lockedLeadLabel?: string
  title?: string
  onSuccess?: () => void
}

/**
 * Jednolity formularz tworzenia zadania — używany w Kanbanie, Terminarzu oraz
 * na kartach nieruchomości / spółdzielni. Odwzorowuje pełny formularz „Dodaj
 * zadanie" z widoku Zadania, żeby wszędzie wyglądał i działał tak samo.
 */
export function TaskFormModal({
  isOpen, onClose, onCreate, userId, canAssign, profiles,
  defaults, canCreateLegal = false, lockedKind, lockedPropertyLabel, lockedKontaktLabel, lockedLeadLabel,
  title = 'Dodaj zadanie', onSuccess,
}: TaskFormModalProps) {
  const buildInitial = (): TaskFormData => ({
    ...EMPTY_TASK_FORM,
    assigned_to: canAssign ? '' : userId,
    ...defaults,
    // Bez uprawnień centrali zawsze zadanie zwykłe — nawet gdyby kontekst
    // podpowiadał inaczej (API pilnuje tego samego).
    ...(canCreateLegal ? {} : { task_kind: 'zwykle' as TaskKind }),
  })

  const [form, setForm] = useState<TaskFormData>(buildInitial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset formularza przy każdym otwarciu — bierze aktualne defaults (np. termin)
  useEffect(() => {
    if (isOpen) { setForm(buildInitial()); setError(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Leniwe ładowanie list powiązań (prawie 2000 kontaktów) — tylko gdy potrzebne
  const [pickProperties, setPickProperties] = useState<EntityPickerItem[]>([])
  const [pickKontakty, setPickKontakty] = useState<EntityPickerItem[]>([])
  const [pickLeads, setPickLeads] = useState<EntityPickerItem[]>([])
  // Ostatnia wizyta per kontakt — pokazywana po wybraniu kontaktu
  const [kontaktVisits, setKontaktVisits] = useState<Record<string, string | null>>({})
  const [propertyKontaktVisits, setPropertyKontaktVisits] = useState<Record<string, string | null>>({})
  const pickersFetched = useRef(false)
  useEffect(() => {
    if (!isOpen || pickersFetched.current) return
    pickersFetched.current = true
    if (!lockedPropertyLabel && !lockedLeadLabel) {
      fetch('/api/properties')
        .then(r => r.ok ? r.json() : [])
        .then((data: { id: string; adres: string; kod_pocztowy: string | null; miasto: string | null; kontakt?: { ostatnia_wizyta?: string | null } }[]) => {
          setPickProperties(data.map(p => ({ id: p.id, label: formatPropertyAddress(p), sublabel: p.miasto })))
          // ostatnia wizyta powiązanego z nieruchomością kontaktu (jeśli jest)
          const pv: Record<string, string | null> = {}
          for (const p of data) if (p.kontakt?.ostatnia_wizyta) pv[p.id] = p.kontakt.ostatnia_wizyta
          setPropertyKontaktVisits(pv)
        })
        .catch(() => {})
    }
    if (!lockedKontaktLabel && !lockedLeadLabel) {
      fetch('/api/kontakty')
        .then(r => r.ok ? r.json() : [])
        .then((data: { id: string; nazwa: string; typ: string; miasto: string | null; ostatnia_wizyta?: string | null }[]) => {
          setPickKontakty(data.map(k => ({
            id: k.id,
            label: k.nazwa,
            sublabel: [KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ, k.miasto].filter(Boolean).join(' · '),
          })))
          setKontaktVisits(Object.fromEntries(data.map(k => [k.id, k.ostatnia_wizyta ?? null])))
        })
        .catch(() => {})
    }
    // Lead pokazujemy w ogólnym formularzu (Kanban/Terminarz) — nie na kartach encji
    if (!lockedLeadLabel && !lockedPropertyLabel && !lockedKontaktLabel) {
      fetch('/api/leads')
        .then(r => r.ok ? r.json() : [])
        .then((data: { id: string; name: string; location: string | null; phone: string | null; status: string }[]) => {
          // Skonwertowanych/odrzuconych nie proponujemy — to zamknięte tematy
          setPickLeads(data
            .filter(l => l.status !== 'converted' && l.status !== 'rejected')
            .map(l => ({ id: l.id, label: l.name, sublabel: [l.location, l.phone].filter(Boolean).join(' · ') || undefined })))
        })
        .catch(() => {})
    }
  }, [isOpen, lockedPropertyLabel, lockedKontaktLabel, lockedLeadLabel])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    setError(null)
    const payload: Partial<Task> = {
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      due_time: form.due_date && form.due_time ? form.due_time : null,
      status: form.status,
      assigned_to: form.assigned_to || null,
      co_assignees: form.co_assignees,
      task_kind: form.task_kind,
      task_type: form.task_type || null,
      contact_category: form.contact_category || null,
      recurrence_freq: form.due_date ? (form.recurrence_freq || null) : null,
      recurrence_interval: form.recurrence_interval || 1,
      recurrence_until: form.recurrence_until || null,
      property_id: form.property_id,
      kontakt_id: form.kontakt_id,
      lead_id: form.lead_id,
      ...(defaults?.board_id !== undefined ? { board_id: defaults.board_id } : {}),
      ...(defaults?.list_id !== undefined ? { list_id: defaults.list_id } : {}),
    }
    const res = await onCreate(payload)
    setSaving(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" confirmClose>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="limona-label block mb-2">Tytuł *</label>
          <input required className="limona-input" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Opisz zadanie..." autoFocus />
        </div>
        <div>
          <label className="limona-label block mb-2">Opis</label>
          <textarea className="limona-input" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Szczegóły..." rows={3} />
        </div>
        {canCreateLegal && (
        <div>
          <label className="limona-label block mb-2">Rodzaj zadania</label>
          <select className="limona-select disabled:opacity-60" value={form.task_kind} disabled={lockedKind}
            onChange={e => setForm(f => ({ ...f, task_kind: e.target.value as TaskKind }))}>
            {TASK_KINDS.map(k => (
              <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>
            ))}
          </select>
          <p className="text-[10px] text-limona-text-dim mt-1">
            {form.task_kind === 'prawne'
              ? 'Trafia do zakładki „Zadania prawne" — widzi je dział prawny i osoba przypisana do nieruchomości.'
              : 'Zwykłe zadanie operacyjne.'}
          </p>
        </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Typ zadania</label>
            <select className="limona-select" value={form.task_type}
              onChange={e => setForm(f => ({ ...f, task_type: e.target.value as TaskType | '' }))}>
              <option value="">—</option>
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map(t => (
                <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Kategoria kontaktu</label>
            <select className="limona-select" value={form.contact_category}
              onChange={e => setForm(f => ({ ...f, contact_category: e.target.value as ContactCategory | '' }))}>
              <option value="">—</option>
              {(Object.keys(CONTACT_CATEGORY_LABELS) as ContactCategory[]).map(c => (
                <option key={c} value={c}>{CONTACT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Powiązania — ukryte/zablokowane gdy tworzymy z karty encji */}
        {lockedLeadLabel ? (
          <div>
            <label className="limona-label block mb-2">Lead</label>
            <div className="limona-input flex items-center gap-1.5 text-limona-lime">
              <LinkIcon size={12} /> <span className="truncate">{lockedLeadLabel}</span>
            </div>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lockedPropertyLabel ? (
            <div>
              <label className="limona-label block mb-2">Nieruchomość</label>
              <div className="limona-input flex items-center gap-1.5 text-limona-blue">
                <LinkIcon size={12} /> <span className="truncate">{lockedPropertyLabel}</span>
              </div>
            </div>
          ) : (
            <EntityPicker
              label="Powiąż z nieruchomością"
              placeholder="Wpisz adres lub miasto..."
              items={pickProperties}
              value={form.property_id}
              onChange={id => setForm(f => ({ ...f, property_id: id }))}
              accentClass="text-limona-blue"
            />
          )}
          {lockedKontaktLabel ? (
            <div>
              <label className="limona-label block mb-2">Kontakt</label>
              <div className="limona-input flex items-center gap-1.5 text-limona-lime">
                <LinkIcon size={12} /> <span className="truncate">{lockedKontaktLabel}</span>
              </div>
            </div>
          ) : (
            <EntityPicker
              label="Powiąż z kontaktem"
              placeholder="Wpisz nazwę lub miasto..."
              items={pickKontakty}
              value={form.kontakt_id}
              onChange={id => setForm(f => ({ ...f, kontakt_id: id }))}
            />
          )}
          </div>
          {(() => {
            const visit = (form.kontakt_id && kontaktVisits[form.kontakt_id])
              || (form.property_id && propertyKontaktVisits[form.property_id]) || null
            if (!visit) return null
            return (
              <p className="text-xs text-limona-blue flex items-center gap-1.5 -mt-1">
                <Clock size={12} /> Ostatnia wizyta u kontaktu: {new Date(visit).toLocaleDateString('pl-PL')}
              </p>
            )
          })()}
          {/* Lead — dostępny w ogólnym formularzu (Kanban/Terminarz) */}
          {!lockedPropertyLabel && !lockedKontaktLabel && (
            <EntityPicker
              label="Powiąż z leadem"
              placeholder="Wpisz nazwę leada..."
              items={pickLeads}
              value={form.lead_id}
              onChange={id => setForm(f => ({ ...f, lead_id: id }))}
              accentClass="text-limona-lime"
            />
          )}
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Priorytet</label>
            <select className="limona-select" value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
              <option value="low">Niski</option>
              <option value="medium">Średni</option>
              <option value="high">Wysoki</option>
              <option value="urgent">Pilny</option>
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Termin</label>
            <div className="flex gap-2">
              <input type="date" className="limona-input flex-1" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              <input type="time" className="limona-input w-24" value={form.due_time}
                disabled={!form.due_date} title={!form.due_date ? 'Ustaw najpierw datę' : 'Godzina (opcjonalnie)'}
                onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="limona-label block mb-2">Powtarzaj (zadanie cykliczne)</label>
            <select className="limona-select disabled:opacity-50"
              value={form.recurrence_freq ? `${form.recurrence_freq}:${form.recurrence_interval}` : ''}
              disabled={!form.due_date}
              onChange={e => {
                const preset = RECURRENCE_PRESETS.find(p => p.value === e.target.value) ?? RECURRENCE_PRESETS[0]
                setForm(f => ({ ...f, recurrence_freq: preset.freq, recurrence_interval: preset.interval }))
              }}>
              {RECURRENCE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {!form.due_date && (
              <p className="text-[10px] text-limona-text-dim mt-1">Ustaw najpierw termin, aby móc powtarzać zadanie.</p>
            )}
          </div>
          {form.due_date && form.recurrence_freq && (
            <div>
              <label className="limona-label block mb-2">Powtarzaj do (opcjonalnie)</label>
              <input type="date" className="limona-input" value={form.recurrence_until}
                min={form.due_date}
                onChange={e => setForm(f => ({ ...f, recurrence_until: e.target.value }))} />
            </div>
          )}
        </div>
        {form.recurrence_freq && (
          <p className="text-xs text-limona-text-dim -mt-2">
            Każde wystąpienie to osobne zadanie z własnymi komentarzami i statusem — nie wpływają na siebie nawzajem.
          </p>
        )}

        <div>
          <label className="limona-label block mb-2">Główny wykonawca</label>
          {canAssign ? (
            <select className="limona-select" value={form.assigned_to}
              onChange={e => {
                const assigned_to = e.target.value
                setForm(f => ({ ...f, assigned_to, co_assignees: f.co_assignees.filter(id => id !== assigned_to) }))
              }}>
              <option value="">Nieprzypisane</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          ) : (
            <p className="limona-input flex items-center text-limona-text-muted">Ty — zadania zawsze trafiają do twórcy</p>
          )}
        </div>

        <div>
          <label className="limona-label block mb-2">Dodatkowi wykonawcy (CC)</label>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {profiles
              .filter(p => p.id !== form.assigned_to)
              .map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-limona-surface-2/50 px-2 py-1 rounded">
                  <input type="checkbox" className="accent-limona-lime"
                    checked={form.co_assignees.includes(p.id)}
                    onChange={e => setForm(f => ({
                      ...f,
                      co_assignees: e.target.checked
                        ? [...f.co_assignees, p.id]
                        : f.co_assignees.filter(id => id !== p.id),
                    }))} />
                  <span className="text-sm text-limona-text">{p.full_name}</span>
                  <span className="text-xs text-limona-text-dim">{p.role}</span>
                </label>
              ))}
          </div>
          {form.co_assignees.length > 0 && (
            <p className="text-xs text-limona-text-dim mt-1">
              {form.co_assignees.length} dodatkowych wykonawców
            </p>
          )}
        </div>

        {error && <p className="text-xs text-limona-red">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="limona-btn-outline">Anuluj</button>
          <button type="submit" disabled={saving || !form.title.trim()} className="limona-btn disabled:opacity-50">
            {saving ? 'Dodawanie...' : 'Dodaj zadanie'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
