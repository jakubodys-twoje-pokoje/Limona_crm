'use client'

import { useState, useEffect } from 'react'
import type { Property, PropertyStatus, PropertyType, ContactType, DealType } from '@/types/database'
import { getStages, DEAL_TYPE_LABELS } from '@/lib/stages'

interface KontaktOption {
  id: string
  nazwa: string
  typ: string
}

interface UserOption {
  id: string
  full_name: string
}

interface PropertyFormProps {
  initial?: Partial<Property>
  onSubmit: (data: Partial<Property>) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: 'mieszkanie', label: 'Mieszkanie' },
  { value: 'dom', label: 'Dom' },
  { value: 'grunt', label: 'Grunt' },
  { value: 'hala', label: 'Hala' },
  { value: 'inne', label: 'Inne' },
]

const contactTypes: { value: ContactType; label: string }[] = [
  { value: 'posrednik', label: 'Pośrednik' },
  { value: 'prywatne', label: 'Prywatne' },
]

const dealTypes: { value: DealType; label: string }[] = [
  { value: 'zadluzony_ponizej', label: 'Zadłużona poniżej wartości' },
  { value: 'zadluzony_powyzej', label: 'Zadłużona powyżej wartości' },
  { value: 'savedeal', label: 'SaveDeal' },
]

const SOURCE_OPTIONS = [
  'OLX', 'Otodom', 'Morizon', 'Gratka', 'Allegro', 'Polecenie',
  'Wolne źródło', 'Komornik', 'Licytacja', 'Spis dłużników', 'Inne',
]

export function PropertyForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Zapisz' }: PropertyFormProps) {
  const [form, setForm] = useState({
    location: initial.location || '',
    phone: initial.phone || '',
    contact_type: initial.contact_type || '',
    property_type: initial.property_type || '',
    area_sqm: initial.area_sqm?.toString() || '',
    value_per_sqm: initial.value_per_sqm?.toString() || '',
    total_debt: initial.total_debt?.toString() || '0',
    debt_type: initial.debt_type || 'below_value',
    creditor1_amount: initial.creditor1_amount?.toString() || '0',
    creditor2_amount: initial.creditor2_amount?.toString() || '0',
    creditor3_amount: initial.creditor3_amount?.toString() || '0',
    owner_coefficient: initial.owner_coefficient?.toString() || '0.025',
    commission_pct: initial.commission_pct?.toString() || '0',
    notary_fee: initial.notary_fee?.toString() || '1000',
    manual_offer: initial.manual_offer?.toString() || '',
    status: initial.status || 'new',
    lead_temperature: initial.lead_temperature || '',
    deal_type: initial.deal_type || '',
    owner_name: initial.owner_name || '',
    kw_number: initial.kw_number || '',
    kw_opis: initial.kw_opis || '',
    source: initial.source || '',
    czynsz_miesieczny: initial.czynsz_miesieczny?.toString() || '',
    trello_link: initial.trello_link || '',
    notes: initial.notes || '',
    kontakt_id: initial.kontakt_id || '',
    uklad: initial.uklad || '',
    pietro: initial.pietro?.toString() || '',
    rok_budowy: initial.rok_budowy?.toString() || '',
    balkon_metraz: initial.balkon_metraz?.toString() || '',
    strony_swiata: initial.strony_swiata || '',
    operat_szacunkowy: initial.operat_szacunkowy?.toString() || '',
  })
  const [loading, setLoading] = useState(false)
  const [kontakty, setKontakty] = useState<KontaktOption[]>([])
  const [kontaktSearch, setKontaktSearch] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [coAssignees, setCoAssignees] = useState<string[]>(initial.co_assignees || [])

  useEffect(() => {
    fetch('/api/kontakty?limit=500')
      .then(r => r.json())
      .then((data: Array<{ id: string; nazwa: string; typ?: string }>) => {
        setKontakty(data.map(k => ({ id: k.id, nazwa: k.nazwa, typ: k.typ || '' })))
      })
      .catch(() => {})
    fetch('/api/profiles')
      .then(r => r.json())
      .then((data: UserOption[]) => setUsers(data))
      .catch(() => {})
  }, [])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  function handleDealTypeChange(newDealType: string) {
    const stages = getStages(newDealType as DealType || null)
    const currentStatusValid = stages.some(s => s.value === form.status)
    setForm(f => ({
      ...f,
      deal_type: newDealType,
      status: currentStatusValid ? f.status : stages[0].value,
      debt_type: newDealType === 'zadluzony_powyzej' ? 'above_value' : 'below_value',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const dealType = (form.deal_type as DealType) || null
      const data: Partial<Property> = {
        location: form.location,
        phone: form.phone || null,
        contact_type: (form.contact_type as ContactType) || null,
        property_type: (form.property_type as PropertyType) || null,
        area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
        value_per_sqm: form.value_per_sqm ? parseFloat(form.value_per_sqm) : null,
        total_debt: parseFloat(form.total_debt) || 0,
        debt_type: dealType === 'zadluzony_powyzej' ? 'above_value' : 'below_value',
        creditor1_amount: parseFloat(form.creditor1_amount) || 0,
        creditor2_amount: parseFloat(form.creditor2_amount) || 0,
        creditor3_amount: parseFloat(form.creditor3_amount) || 0,
        owner_coefficient: parseFloat(form.owner_coefficient) || 0.025,
        commission_pct: parseFloat(form.commission_pct) || 0,
        notary_fee: parseFloat(form.notary_fee) || 1000,
        manual_offer: form.manual_offer ? parseFloat(form.manual_offer) : null,
        status: form.status as PropertyStatus,
        lead_temperature: (form.lead_temperature as Property['lead_temperature']) || null,
        deal_type: dealType,
        owner_name: form.owner_name || null,
        kw_number: form.kw_number || null,
        kw_opis: form.kw_opis || null,
        source: form.source || null,
        czynsz_miesieczny: form.czynsz_miesieczny ? parseFloat(form.czynsz_miesieczny) : null,
        trello_link: form.trello_link || null,
        notes: form.notes || null,
        kontakt_id: form.kontakt_id || null,
        uklad: form.uklad || null,
        pietro: form.pietro ? parseInt(form.pietro) : null,
        rok_budowy: form.rok_budowy ? parseInt(form.rok_budowy) : null,
        balkon_metraz: form.balkon_metraz ? parseFloat(form.balkon_metraz) : null,
        strony_swiata: form.strony_swiata || null,
        operat_szacunkowy: form.operat_szacunkowy ? parseFloat(form.operat_szacunkowy) : null,
        co_assignees: coAssignees,
      }
      await onSubmit(data)
    } finally {
      setLoading(false)
    }
  }

  const dealType = (form.deal_type as DealType) || null
  const stages = getStages(dealType)
  const isAboveValue = dealType === 'zadluzony_powyzej'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Typ transakcji */}
      <div>
        <h3 className="limona-eyebrow mb-4">Typ transakcji</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Typ deal</label>
            <select
              className="limona-select"
              value={form.deal_type}
              onChange={e => handleDealTypeChange(e.target.value)}
            >
              <option value="">— Nie ustawiono (legacy) —</option>
              {dealTypes.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Etap / Status</label>
            <select
              className="limona-select"
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              {stages.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Temperatura leada</label>
            <select className="limona-select" value={form.lead_temperature} onChange={e => set('lead_temperature', e.target.value)}>
              <option value="">—</option>
              <option value="goracy">Gorący</option>
              <option value="sredni">Średni</option>
              <option value="zimny">Zimny</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dane podstawowe */}
      <div>
        <h3 className="limona-eyebrow mb-4">Dane podstawowe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="limona-label block mb-2">Lokalizacja *</label>
            <input
              required
              className="limona-input"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="np. Kraków, Mazowiecka 117/71"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Właściciel</label>
            <input
              className="limona-input"
              value={form.owner_name}
              onChange={e => set('owner_name', e.target.value)}
              placeholder="Imię i nazwisko właściciela"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Telefon</label>
            <input
              className="limona-input"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+48 600 000 000"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Typ kontaktu</label>
            <select className="limona-select" value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
              <option value="">Wybierz...</option>
              {contactTypes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Typ nieruchomości</label>
            <select className="limona-select" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
              <option value="">Wybierz...</option>
              {propertyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="limona-label block mb-2">Metraż (m²)</label>
            <input
              type="number"
              className="limona-input"
              value={form.area_sqm}
              onChange={e => set('area_sqm', e.target.value)}
              placeholder="65.5"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Źródło leada</label>
            <input
              list="source-options"
              className="limona-input"
              value={form.source}
              onChange={e => set('source', e.target.value)}
              placeholder="np. OLX, Polecenie..."
            />
            <datalist id="source-options">
              {SOURCE_OPTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className="limona-label block mb-2">Link Trello</label>
            <input
              className="limona-input"
              value={form.trello_link}
              onChange={e => set('trello_link', e.target.value)}
              placeholder="https://trello.com/..."
            />
          </div>
          {users.length > 0 && (
            <div className="md:col-span-2">
              <label className="limona-label block mb-2">Dodatkowi opiekunowie</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => {
                  const checked = coAssignees.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setCoAssignees(prev =>
                        checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                        checked
                          ? 'border-limona-lime bg-limona-lime/15 text-limona-lime'
                          : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
                      }`}
                    >
                      {u.full_name}
                    </button>
                  )
                })}
              </div>
              {coAssignees.length > 0 && (
                <p className="text-xs text-limona-text-dim mt-1">
                  {coAssignees.length} wybranych
                </p>
              )}
            </div>
          )}
          <div className="md:col-span-2">
            <label className="limona-label block mb-2">Powiązany kontakt</label>
            <input
              list="kontakt-options"
              className="limona-input"
              placeholder="Wpisz nazwę kontaktu..."
              value={kontaktSearch || (form.kontakt_id ? (kontakty.find(k => k.id === form.kontakt_id)?.nazwa || '') : '')}
              onChange={e => {
                setKontaktSearch(e.target.value)
                const match = kontakty.find(k => k.nazwa === e.target.value)
                if (match) { set('kontakt_id', match.id); setKontaktSearch('') }
                else if (e.target.value === '') set('kontakt_id', '')
              }}
            />
            <datalist id="kontakt-options">
              {kontakty.map(k => (
                <option key={k.id} value={k.nazwa}>{k.typ}</option>
              ))}
            </datalist>
            {form.kontakt_id && (
              <p className="text-xs text-limona-lime mt-1">
                Wybrany: {kontakty.find(k => k.id === form.kontakt_id)?.nazwa}{' '}
                <button type="button" className="text-limona-text-dim hover:text-limona-red ml-1" onClick={() => { set('kontakt_id', ''); setKontaktSearch('') }}>✕</button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dane fizyczne */}
      <div>
        <h3 className="limona-eyebrow mb-4">Dane fizyczne</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="limona-label block mb-2">Układ</label>
            <input
              className="limona-input"
              value={form.uklad}
              onChange={e => set('uklad', e.target.value)}
              placeholder="np. 3 pokoje + kuchnia"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Piętro</label>
            <input
              type="number"
              className="limona-input"
              value={form.pietro}
              onChange={e => set('pietro', e.target.value)}
              placeholder="np. 3"
              min="0"
              max="99"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Rok budowy</label>
            <input
              type="number"
              className="limona-input"
              value={form.rok_budowy}
              onChange={e => set('rok_budowy', e.target.value)}
              placeholder="np. 1985"
              min="1800"
              max="2030"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Balkon/Taras (m²)</label>
            <input
              type="number"
              className="limona-input"
              value={form.balkon_metraz}
              onChange={e => set('balkon_metraz', e.target.value)}
              placeholder="np. 8.5"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Strony świata</label>
            <input
              className="limona-input"
              value={form.strony_swiata}
              onChange={e => set('strony_swiata', e.target.value)}
              placeholder="np. N, E, S"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Operat szacunkowy [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.operat_szacunkowy}
              onChange={e => set('operat_szacunkowy', e.target.value)}
              placeholder="np. 520000"
              min="0"
              step="1000"
            />
          </div>
        </div>
      </div>

      {/* Księga Wieczysta */}
      <div>
        <h3 className="limona-eyebrow mb-4">Księga Wieczysta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Numer KW</label>
            <input
              className="limona-input"
              value={form.kw_number}
              onChange={e => set('kw_number', e.target.value)}
              placeholder="np. KR1P/00123456/7"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Opis KW</label>
            <input
              className="limona-input"
              value={form.kw_opis}
              onChange={e => set('kw_opis', e.target.value)}
              placeholder="Uwagi do KW..."
            />
          </div>
        </div>
      </div>

      {/* Wartości finansowe */}
      <div>
        <h3 className="limona-eyebrow mb-4">Wartości finansowe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Wartość po najniższej m² (I) [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.value_per_sqm}
              onChange={e => set('value_per_sqm', e.target.value)}
              placeholder="656000"
              min="0"
              step="1000"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Suma zadłużenia (K) [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.total_debt}
              onChange={e => set('total_debt', e.target.value)}
              placeholder="0"
              min="0"
              step="1000"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Prowizja pośrednika (%)</label>
            <input
              type="text"
              inputMode="decimal"
              className="limona-input"
              value={form.commission_pct}
              onChange={e => {
                const v = e.target.value.replace(',', '.')
                if (v === '' || /^\d*\.?\d*$/.test(v)) set('commission_pct', v)
              }}
              placeholder="2.46"
            />
            <span className="text-xs text-limona-text-dim">Wpisz jako %, np. 2.46</span>
          </div>
          <div>
            <label className="limona-label block mb-2">Taksa notarialna [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.notary_fee}
              onChange={e => set('notary_fee', e.target.value)}
              placeholder="1000"
              min="0"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Ręczna oferta (opcjonalnie) [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.manual_offer}
              onChange={e => set('manual_offer', e.target.value)}
              placeholder="445000"
              min="0"
              step="1000"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Czynsz miesięczny [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.czynsz_miesieczny}
              onChange={e => set('czynsz_miesieczny', e.target.value)}
              placeholder="1500"
              min="0"
              step="100"
            />
          </div>
        </div>
      </div>

      {/* Wierzyciele — tylko zadluzony_powyzej */}
      {isAboveValue && (
        <div>
          <h3 className="limona-eyebrow mb-4">Wierzyciele</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Kwota 1. wierzyciela [zł]</label>
              <input type="number" className="limona-input" value={form.creditor1_amount} onChange={e => set('creditor1_amount', e.target.value)} placeholder="600000" min="0" />
            </div>
            <div>
              <label className="limona-label block mb-2">Kwota 2. wierzyciela [zł]</label>
              <input type="number" className="limona-input" value={form.creditor2_amount} onChange={e => set('creditor2_amount', e.target.value)} placeholder="150000" min="0" />
            </div>
            <div>
              <label className="limona-label block mb-2">Kwota 3. wierzyciela [zł]</label>
              <input type="number" className="limona-input" value={form.creditor3_amount} onChange={e => set('creditor3_amount', e.target.value)} placeholder="40000" min="0" />
            </div>
            <div>
              <label className="limona-label block mb-2">Współczynnik właściciela (R)</label>
              <input type="number" className="limona-input" value={form.owner_coefficient} onChange={e => set('owner_coefficient', e.target.value)} placeholder="0.025" min="0" max="1" step="0.001" />
              <span className="text-xs text-limona-text-dim">Domyślnie 0.025 = 2.5%</span>
            </div>
          </div>
        </div>
      )}

      {/* Notatki */}
      <div>
        <label className="limona-label block mb-2">Notatki</label>
        <textarea
          className="limona-input min-h-[80px] resize-y"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Dodatkowe informacje..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="limona-btn-outline">
          Anuluj
        </button>
        <button type="submit" disabled={loading} className="limona-btn disabled:opacity-50">
          {loading ? 'Zapisywanie...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
