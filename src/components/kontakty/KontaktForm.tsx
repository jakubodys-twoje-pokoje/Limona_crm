'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Kontakt, KontaktTyp, Profile } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY, TYPY_SPOLDZIELNIA, TYPY_Z_PROWIZJA } from '@/types/database'

const WOJEWODZTWA = [
  'dolnośląskie','kujawsko-pomorskie','lubelskie','lubuskie','łódzkie',
  'małopolskie','mazowieckie','opolskie','podkarpackie','podlaskie',
  'pomorskie','śląskie','świętokrzyskie','warmińsko-mazurskie',
  'wielkopolskie','zachodniopomorskie',
]

interface Props {
  initial?: Partial<Kontakt>
  profiles: Profile[]
  onSubmit: (data: Partial<Kontakt>) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const DEFAULTS: Partial<Kontakt> = {
  typ: 'spoldzielnia',
  nazwa: '',
  wojewodztwo: '',
  miasto: '',
  ulica: '',
  godziny_otwarcia: '',
  telefon: '',
  email: '',
  opis: '',
  assigned_to: null,
  oddzial: '',
  liczba_budynkow: null,
  liczba_mieszkan: null,
  wizyta_osobista: false,
  wyslany_mail_oferta: false,
  zgoda_ulotki: false,
  zgoda_plakat: false,
  chec_wspolpracy: false,
  niezainteresowani: false,
  operator_budowy_zainteresowani: false,
  ustalona_prowizja: '',
  umowa_url: '',
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-xs uppercase tracking-wider text-limona-text-muted font-medium">{label}</label>
      {children}
    </div>
  )
}

export function KontaktForm({ initial, profiles, onSubmit, onCancel, submitLabel = 'Zapisz' }: Props) {
  const [form, setForm] = useState<Partial<Kontakt>>({ ...DEFAULTS, ...initial })
  const [submitting, setSubmitting] = useState(false)

  const typ = (form.typ || 'spoldzielnia') as KontaktTyp
  const isSpoldzielnia = TYPY_SPOLDZIELNIA.has(typ)
  const hasWspolpracaWithProwizja = TYPY_Z_PROWIZJA.has(typ)

  function set(field: keyof Kontakt, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nazwa?.trim()) return
    setSubmitting(true)

    const payload: Partial<Kontakt> = {
      ...form,
      // Null out irrelevant fields based on type
      liczba_budynkow: isSpoldzielnia ? (form.liczba_budynkow ?? null) : null,
      liczba_mieszkan: isSpoldzielnia ? (form.liczba_mieszkan ?? null) : null,
      ustalona_prowizja: (hasWspolpracaWithProwizja && form.chec_wspolpracy) ? (form.ustalona_prowizja || null) : null,
      umowa_url:         (hasWspolpracaWithProwizja && form.chec_wspolpracy) ? (form.umowa_url || null) : null,
    }

    await onSubmit(payload)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sekcja: dane podstawowe */}
      <div>
        <p className="limona-eyebrow mb-4">Dane podstawowe</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Typ *" className="sm:col-span-2">
            <select
              className="limona-input w-full"
              value={form.typ || ''}
              onChange={e => set('typ', e.target.value)}
              required
            >
              {KONTAKT_TYPY.map(t => (
                <option key={t} value={t}>{KONTAKT_TYP_LABELS[t]}</option>
              ))}
            </select>
          </Field>

          <Field label="Nazwa *" className="sm:col-span-2">
            <input
              className="limona-input w-full"
              value={form.nazwa || ''}
              onChange={e => set('nazwa', e.target.value)}
              required
              placeholder="Pełna nazwa instytucji / osoby"
            />
          </Field>

          <Field label="Województwo">
            <select
              className="limona-input w-full"
              value={form.wojewodztwo || ''}
              onChange={e => set('wojewodztwo', e.target.value)}
            >
              <option value="">— wybierz —</option>
              {WOJEWODZTWA.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </Field>

          <Field label="Miasto">
            <input
              className="limona-input w-full"
              value={form.miasto || ''}
              onChange={e => set('miasto', e.target.value)}
              placeholder="Miasto"
            />
          </Field>

          <Field label="Ulica / Adres" className="sm:col-span-2">
            <input
              className="limona-input w-full"
              value={form.ulica || ''}
              onChange={e => set('ulica', e.target.value)}
              placeholder="ul. Przykładowa 1/2"
            />
          </Field>

          <Field label="Godziny otwarcia / przyjęć stron">
            <input
              className="limona-input w-full"
              value={form.godziny_otwarcia || ''}
              onChange={e => set('godziny_otwarcia', e.target.value)}
              placeholder="np. Pn–Pt 9:00–15:00"
            />
          </Field>

          <Field label="Telefon">
            <input
              className="limona-input w-full"
              value={form.telefon || ''}
              onChange={e => set('telefon', e.target.value)}
              placeholder="+48 000 000 000"
            />
          </Field>

          <Field label="E-mail">
            <input
              type="email"
              className="limona-input w-full"
              value={form.email || ''}
              onChange={e => set('email', e.target.value)}
              placeholder="kontakt@firma.pl"
            />
          </Field>

          <Field label="Przypisana osoba">
            <select
              className="limona-input w-full"
              value={form.assigned_to || ''}
              onChange={e => set('assigned_to', e.target.value || null)}
            >
              <option value="">— brak przypisania —</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>

          <Field label="Oddział (opcjonalnie)">
            <input
              className="limona-input w-full"
              value={form.oddzial || ''}
              onChange={e => set('oddzial', e.target.value)}
              placeholder="np. Oddział Kraków"
            />
          </Field>

          <Field label="Opis" className="sm:col-span-2">
            <textarea
              className="limona-input w-full resize-none"
              rows={3}
              value={form.opis || ''}
              onChange={e => set('opis', e.target.value)}
              placeholder="Dodatkowe informacje o kontakcie…"
            />
          </Field>
        </div>
      </div>

      {/* Sekcja: pola specyficzne dla spółdzielni/wspólnoty */}
      {isSpoldzielnia && (
        <div>
          <p className="limona-eyebrow mb-4">Dane zasobu</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Liczba budynków">
              <input
                type="number"
                min={0}
                className="limona-input w-full"
                value={form.liczba_budynkow ?? ''}
                onChange={e => set('liczba_budynkow', e.target.value ? parseInt(e.target.value) : null)}
              />
            </Field>
            <Field label="Liczba mieszkań">
              <input
                type="number"
                min={0}
                className="limona-input w-full"
                value={form.liczba_mieszkan ?? ''}
                onChange={e => set('liczba_mieszkan', e.target.value ? parseInt(e.target.value) : null)}
              />
            </Field>
          </div>
        </div>
      )}

      {/* Sekcja: statusy realizacji */}
      <div>
        <p className="limona-eyebrow mb-4">Statusy realizacji</p>
        <div className="flex flex-wrap gap-4">
          {([
            ['wizyta_osobista',    'Wizyta osobista'],
            ['wyslany_mail_oferta','Wysłany mail z ofertą / zostawiona oferta'],
          ] as [keyof Kontakt, string][]).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
              <input
                type="checkbox"
                checked={!!form[field]}
                onChange={e => set(field, e.target.checked)}
                className="accent-[#BEFF00] w-4 h-4"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Sekcja: statusy wykonawcze */}
      <div>
        <p className="limona-eyebrow mb-4">Statusy wykonawcze</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
            <input
              type="checkbox"
              checked={!!form.chec_wspolpracy}
              onChange={e => set('chec_wspolpracy', e.target.checked)}
              className="accent-[#BEFF00] w-4 h-4"
            />
            Chęć współpracy (będą polecać)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
            <input
              type="checkbox"
              checked={!!form.niezainteresowani}
              onChange={e => set('niezainteresowani', e.target.checked)}
              className="accent-[#BEFF00] w-4 h-4"
            />
            Niezainteresowani
          </label>
          {isSpoldzielnia && (
            <>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
                <input
                  type="checkbox"
                  checked={!!form.zgoda_ulotki}
                  onChange={e => set('zgoda_ulotki', e.target.checked)}
                  className="accent-[#BEFF00] w-4 h-4"
                />
                Zgoda na ulotki
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
                <input
                  type="checkbox"
                  checked={!!form.zgoda_plakat}
                  onChange={e => set('zgoda_plakat', e.target.checked)}
                  className="accent-[#BEFF00] w-4 h-4"
                />
                Zgoda na plakat
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text hover:text-limona-white transition-colors">
                <input
                  type="checkbox"
                  checked={!!form.operator_budowy_zainteresowani}
                  onChange={e => set('operator_budowy_zainteresowani', e.target.checked)}
                  className="accent-[#BEFF00] w-4 h-4"
                />
                Operator do budowy na gruncie — zainteresowani
              </label>
            </>
          )}
        </div>
      </div>

      {/* Sekcja: prowizja i umowa (gdy chęć współpracy i typ ją obsługuje) */}
      {hasWspolpracaWithProwizja && form.chec_wspolpracy && (
        <div>
          <p className="limona-eyebrow mb-4">Warunki współpracy</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ustalona prowizja (tekst/%)">
              <input
                className="limona-input w-full"
                value={form.ustalona_prowizja || ''}
                onChange={e => set('ustalona_prowizja', e.target.value)}
                placeholder="np. 2% lub 500 zł"
              />
            </Field>
            <Field label="Link do umowy (URL pliku)">
              <input
                className="limona-input w-full"
                value={form.umowa_url || ''}
                onChange={e => set('umowa_url', e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="limona-btn-outline">
          Anuluj
        </button>
        <button
          type="submit"
          disabled={submitting || !form.nazwa?.trim()}
          className={cn('limona-btn', submitting && 'opacity-60 cursor-not-allowed')}
        >
          {submitting ? 'Zapisywanie…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
