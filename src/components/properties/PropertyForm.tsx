'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { Property, PropertyType, DealType, PropertyCost } from '@/types/database'
import { DEAL_TYPE_LABELS } from '@/lib/stages'
import { sumCosts } from '@/lib/calculator'
import { formatMoney } from '@/lib/utils'

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

const dealTypes: { value: DealType; label: string }[] = [
  { value: 'zadluzony_ponizej', label: DEAL_TYPE_LABELS.zadluzony_ponizej },
  { value: 'zadluzony_powyzej', label: DEAL_TYPE_LABELS.zadluzony_powyzej },
]

export function PropertyForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Zapisz' }: PropertyFormProps) {
  const [form, setForm] = useState({
    adres: initial.adres || '',
    kod_pocztowy: initial.kod_pocztowy || '',
    miasto: initial.miasto || '',
    phone: initial.phone || '',
    property_type: initial.property_type || '',
    area_sqm: initial.area_sqm?.toString() || '',
    value_per_sqm: initial.value_per_sqm?.toString() || '',
    wartosc_realna: initial.wartosc_realna?.toString() || '',
    total_debt: initial.total_debt?.toString() || '0',
    debt_type: initial.debt_type || 'below_value',
    creditor1_amount: initial.creditor1_amount?.toString() || '0',
    creditor2_amount: initial.creditor2_amount?.toString() || '0',
    creditor3_amount: initial.creditor3_amount?.toString() || '0',
    owner_coefficient: initial.owner_coefficient?.toString() || '0.025',
    deal_type: initial.deal_type || '',
    owner_name: initial.owner_name || '',
    kw_number: initial.kw_number || '',
    kw_dzial1_komentarz: initial.kw_dzial1_komentarz || '',
    kw_dzial2_komentarz: initial.kw_dzial2_komentarz || '',
    kw_dzial3_komentarz: initial.kw_dzial3_komentarz || '',
    kw_dzial4_komentarz: initial.kw_dzial4_komentarz || '',
    czynsz_miesieczny: initial.czynsz_miesieczny?.toString() || '',
    notes: initial.notes || '',
    kontakt_id: initial.kontakt_id || '',
    uklad: initial.uklad || '',
    pietro: initial.pietro?.toString() || '',
    pietro_z_ilu: initial.pietro_z_ilu?.toString() || '',
    rok_budowy: initial.rok_budowy?.toString() || '',
    balkon_metraz: initial.balkon_metraz?.toString() || '',
    strony_swiata: initial.strony_swiata || '',
    wycena_szacunkowa: initial.wycena_szacunkowa?.toString() || '',
  })
  const [koszty, setKoszty] = useState<PropertyCost[]>(initial.koszty_dodatkowe || [])
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
    setForm(f => ({
      ...f,
      deal_type: newDealType,
      debt_type: newDealType === 'zadluzony_powyzej' ? 'above_value' : 'below_value',
    }))
  }

  function updateKoszt(i: number, patch: Partial<PropertyCost>) {
    setKoszty(prev => prev.map((k, idx) => idx === i ? { ...k, ...patch } : k))
  }

  function removeKoszt(i: number) {
    setKoszty(prev => prev.filter((_, idx) => idx !== i))
  }

  function addKoszt() {
    setKoszty(prev => [...prev, { label: '', value: 0 }])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const dealType = (form.deal_type as DealType) || null
      const data: Partial<Property> = {
        adres: form.adres,
        kod_pocztowy: form.kod_pocztowy || null,
        miasto: form.miasto || null,
        phone: form.phone || null,
        property_type: (form.property_type as PropertyType) || null,
        area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
        value_per_sqm: form.value_per_sqm ? parseFloat(form.value_per_sqm) : null,
        wartosc_realna: form.wartosc_realna ? parseFloat(form.wartosc_realna) : null,
        total_debt: parseFloat(form.total_debt) || 0,
        debt_type: dealType === 'zadluzony_powyzej' ? 'above_value' : 'below_value',
        creditor1_amount: parseFloat(form.creditor1_amount) || 0,
        creditor2_amount: parseFloat(form.creditor2_amount) || 0,
        creditor3_amount: parseFloat(form.creditor3_amount) || 0,
        owner_coefficient: parseFloat(form.owner_coefficient) || 0.025,
        koszty_dodatkowe: koszty.filter(k => k.label.trim()).map(k => ({ label: k.label.trim(), value: Number(k.value) || 0 })),
        deal_type: dealType,
        owner_name: form.owner_name || null,
        kw_number: form.kw_number || null,
        kw_dzial1_komentarz: form.kw_dzial1_komentarz || null,
        kw_dzial2_komentarz: form.kw_dzial2_komentarz || null,
        kw_dzial3_komentarz: form.kw_dzial3_komentarz || null,
        kw_dzial4_komentarz: form.kw_dzial4_komentarz || null,
        czynsz_miesieczny: form.czynsz_miesieczny ? parseFloat(form.czynsz_miesieczny) : null,
        notes: form.notes || null,
        kontakt_id: form.kontakt_id || null,
        uklad: form.uklad || null,
        pietro: form.pietro ? parseInt(form.pietro) : null,
        pietro_z_ilu: form.pietro_z_ilu ? parseInt(form.pietro_z_ilu) : null,
        rok_budowy: form.rok_budowy ? parseInt(form.rok_budowy) : null,
        balkon_metraz: form.balkon_metraz ? parseFloat(form.balkon_metraz) : null,
        strony_swiata: form.strony_swiata || null,
        wycena_szacunkowa: form.wycena_szacunkowa ? parseFloat(form.wycena_szacunkowa) : null,
        co_assignees: coAssignees,
      }
      await onSubmit(data)
    } finally {
      setLoading(false)
    }
  }

  const dealType = (form.deal_type as DealType) || null
  const isAboveValue = dealType === 'zadluzony_powyzej'
  const kosztyTotal = sumCosts(koszty)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Typ transakcji */}
      <div>
        <h3 className="limona-eyebrow mb-4">Typ transakcji</h3>
        <div>
          <label className="limona-label block mb-2">Powyżej / poniżej wartości</label>
          <select
            className="limona-select"
            value={form.deal_type}
            onChange={e => handleDealTypeChange(e.target.value)}
          >
            <option value="">— Nie ustawiono —</option>
            {dealTypes.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <p className="text-xs text-limona-text-dim mt-1">
            Status dłużnika i status inwestora ustawia się później, w zakładce „Checklista i status&rdquo; nieruchomości.
          </p>
        </div>
      </div>

      {/* Dane podstawowe */}
      <div>
        <h3 className="limona-eyebrow mb-4">Dane podstawowe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="limona-label block mb-2">Adres *</label>
            <input
              required
              className="limona-input"
              value={form.adres}
              onChange={e => set('adres', e.target.value)}
              placeholder="np. Mazowiecka 117/71"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Kod pocztowy</label>
            <input
              className="limona-input"
              value={form.kod_pocztowy}
              onChange={e => set('kod_pocztowy', e.target.value)}
              placeholder="30-001"
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Miasto</label>
            <input
              className="limona-input"
              value={form.miasto}
              onChange={e => set('miasto', e.target.value)}
              placeholder="Kraków"
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
            <label className="limona-label block mb-2">Liczba pięter w budynku</label>
            <input
              type="number"
              className="limona-input"
              value={form.pietro_z_ilu}
              onChange={e => set('pietro_z_ilu', e.target.value)}
              placeholder="np. 5"
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
            <label className="limona-label block mb-2">Wycena szacunkowa [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.wycena_szacunkowa}
              onChange={e => set('wycena_szacunkowa', e.target.value)}
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
          <div className="md:col-span-2">
            <label className="limona-label block mb-2">Numer KW</label>
            <input
              className="limona-input"
              value={form.kw_number}
              onChange={e => set('kw_number', e.target.value)}
              placeholder="np. KR1P/00123456/7"
            />
          </div>
          {([
            ['kw_dzial1_komentarz', 'Dział I — oznaczenie nieruchomości'],
            ['kw_dzial2_komentarz', 'Dział II — własność'],
            ['kw_dzial3_komentarz', 'Dział III — ciężary i ograniczenia'],
            ['kw_dzial4_komentarz', 'Dział IV — hipoteki'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="limona-label block mb-2">{label}</label>
              <textarea
                className="limona-input min-h-[60px] resize-y text-sm"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder="Komentarz..."
              />
            </div>
          ))}
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
            <label className="limona-label block mb-2">Wartość realna [zł]</label>
            <input
              type="number"
              className="limona-input"
              value={form.wartosc_realna}
              onChange={e => set('wartosc_realna', e.target.value)}
              placeholder="700000"
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

        {/* Suma kosztów — dynamiczna lista */}
        <div className="mt-4">
          <label className="limona-label block mb-2">Suma kosztów</label>
          <div className="space-y-2">
            {koszty.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="limona-input flex-1"
                  value={k.label}
                  onChange={e => updateKoszt(i, { label: e.target.value })}
                  placeholder="np. Taksa notarialna"
                />
                <input
                  type="number"
                  className="limona-input w-32"
                  value={k.value || ''}
                  onChange={e => updateKoszt(i, { value: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  min="0"
                  step="100"
                />
                <button type="button" onClick={() => removeKoszt(i)} className="p-2 text-limona-text-dim hover:text-limona-red transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addKoszt}
              className="text-xs text-limona-text-dim hover:text-limona-lime flex items-center gap-1 transition-colors">
              <Plus size={12} /> Dodaj koszt
            </button>
          </div>
          <div className="border-t border-limona-border mt-3 pt-3 flex items-center justify-between">
            <span className="text-sm text-limona-text-muted">Suma kosztów</span>
            <span className="font-mono font-bold text-limona-white">{formatMoney(kosztyTotal)}</span>
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
