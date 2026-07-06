'use client'

import { useState } from 'react'
import type { Property, PropertyStatus, PropertyType, ContactType } from '@/types/database'

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

const statuses: { value: PropertyStatus; label: string }[] = [
  { value: 'new', label: 'Nowa' },
  { value: 'analysis', label: 'Analiza' },
  { value: 'offer_sent', label: 'Oferta wysłana' },
  { value: 'negotiation', label: 'Negocjacja' },
  { value: 'contract', label: 'Umowa' },
  { value: 'legal_cleanup', label: 'Regulacja prawna' },
  { value: 'sale', label: 'Sprzedaż' },
  { value: 'completed', label: 'Zakończona' },
  { value: 'rejected', label: 'Odrzucona' },
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
    trello_link: initial.trello_link || '',
    notes: initial.notes || '',
  })
  const [loading, setLoading] = useState(false)

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const data: Partial<Property> = {
      location: form.location,
      phone: form.phone || null,
      contact_type: (form.contact_type as ContactType) || null,
      property_type: (form.property_type as PropertyType) || null,
      area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
      value_per_sqm: form.value_per_sqm ? parseFloat(form.value_per_sqm) : null,
      total_debt: parseFloat(form.total_debt) || 0,
      debt_type: form.debt_type as 'below_value' | 'above_value',
      creditor1_amount: parseFloat(form.creditor1_amount) || 0,
      creditor2_amount: parseFloat(form.creditor2_amount) || 0,
      creditor3_amount: parseFloat(form.creditor3_amount) || 0,
      owner_coefficient: parseFloat(form.owner_coefficient) || 0.025,
      commission_pct: parseFloat(form.commission_pct) || 0,
      notary_fee: parseFloat(form.notary_fee) || 1000,
      manual_offer: form.manual_offer ? parseFloat(form.manual_offer) : null,
      status: form.status as PropertyStatus,
      lead_temperature: (form.lead_temperature as Property['lead_temperature']) || null,
      trello_link: form.trello_link || null,
      notes: form.notes || null,
    }
    await onSubmit(data)
    setLoading(false)
  }

  const isAbove = form.debt_type === 'above_value'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            <label className="limona-label block mb-2">Status</label>
            <select className="limona-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
          <div>
            <label className="limona-label block mb-2">Link Trello</label>
            <input
              className="limona-input"
              value={form.trello_link}
              onChange={e => set('trello_link', e.target.value)}
              placeholder="https://trello.com/..."
            />
          </div>
        </div>
      </div>

      {/* Wartości */}
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
            <label className="limona-label block mb-2">Typ zadłużenia</label>
            <select className="limona-select" value={form.debt_type} onChange={e => set('debt_type', e.target.value)}>
              <option value="below_value">Poniżej wartości</option>
              <option value="above_value">Powyżej wartości (wierzyciele)</option>
            </select>
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
            <span className="text-xs text-limona-text-dim">Wpisz jako %, np. 2.46 — dziesiętne OK</span>
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
        </div>
      </div>

      {/* Wierzyciele — tylko gdy above_value */}
      {isAbove && (
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
