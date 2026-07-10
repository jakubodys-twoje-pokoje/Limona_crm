'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { isOpenNow, hasAnyHours } from '@/lib/godziny'
import { useAuth } from '@/hooks/useAuth'
import { canSeeInvestors } from '@/lib/roles'
import type { Kontakt, KontaktTyp, Profile } from '@/types/database'
import { KONTAKT_TYP_LABELS, KONTAKT_TYPY } from '@/types/database'

const WOJEWODZTWA = [
  'dolnośląskie','kujawsko-pomorskie','lubelskie','lubuskie','łódzkie',
  'małopolskie','mazowieckie','opolskie','podkarpackie','podlaskie',
  'pomorskie','śląskie','świętokrzyskie','warmińsko-mazurskie',
  'wielkopolskie','zachodniopomorskie',
]

type SortKey = 'nazwa' | 'typ' | 'wojewodztwo' | 'miasto' | 'assignee'

interface Props {
  kontakty: Kontakt[]
  loading: boolean
  profiles: Profile[]
  onAdd: () => void
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        active ? 'bg-limona-lime' : 'bg-limona-border'
      )}
    />
  )
}

function CoopBadge({ kontakt }: { kontakt: Kontakt }) {
  if (kontakt.chec_wspolpracy)   return <span className="limona-badge text-[10px] bg-limona-lime/10 text-limona-lime border-limona-lime/30">Współpraca</span>
  if (kontakt.niezainteresowani) return <span className="limona-badge text-[10px] bg-limona-red/10 text-limona-red border-limona-red/30">Niezainteresowani</span>
  return <span className="limona-badge text-[10px] text-limona-text-muted border-limona-border">Brak danych</span>
}

function FilterCheckbox({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-limona-text-muted hover:text-limona-white transition-colors select-none whitespace-nowrap">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-[#BEFF00] w-3.5 h-3.5 flex-shrink-0"
      />
      {label}
    </label>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-limona-text-dim font-bold">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{children}</div>
    </div>
  )
}

export function KontaktyTable({ kontakty, loading, profiles, onAdd }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const visibleTypy = canSeeInvestors(profile?.role) ? KONTAKT_TYPY : KONTAKT_TYPY.filter(t => t !== 'inwestor')

  // Dropdown / text filters
  const [search,         setSearch]         = useState('')
  const [typFilter,      setTypFilter]      = useState('')
  const [wojFilter,      setWojFilter]      = useState('')
  const [miastoFilter,   setMiastoFilter]   = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [showFilters,    setShowFilters]    = useState(false)

  // Statusy realizacji
  const [fWizyta, setFWizyta] = useState(false)
  const [fMail,   setFMail]   = useState(false)

  // Statusy wykonawcze
  const [fCoop,     setFCoop]     = useState(false)
  const [fNie,      setFNie]      = useState(false)
  const [fUlotki,   setFUlotki]   = useState(false)
  const [fPlakat,   setFPlakat]   = useState(false)
  const [fOperator, setFOperator] = useState(false)

  // Dane kontaktu
  const [fGodziny,    setFGodziny]    = useState(false)
  const [fOtwarte,    setFOtwarte]    = useState(false)
  const [fTelefon,    setFTelefon]    = useState(false)
  const [fEmail,      setFEmail]      = useState(false)
  const [fBezOpiek,   setFBezOpiek]   = useState(false)
  const [fProwizja,   setFProwizja]   = useState(false)
  const [fUmowa,      setFUmowa]      = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>('nazwa')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const activeFilterCount = [
    typFilter, wojFilter, miastoFilter, assignedFilter,
    fWizyta, fMail, fCoop, fNie, fUlotki, fPlakat, fOperator,
    fGodziny, fOtwarte, fTelefon, fEmail, fBezOpiek, fProwizja, fUmowa,
  ].filter(Boolean).length

  function resetFilters() {
    setTypFilter(''); setWojFilter(''); setMiastoFilter(''); setAssignedFilter('')
    setFWizyta(false); setFMail(false); setFCoop(false); setFNie(false)
    setFUlotki(false); setFPlakat(false); setFOperator(false)
    setFGodziny(false); setFOtwarte(false); setFTelefon(false)
    setFEmail(false); setFBezOpiek(false); setFProwizja(false); setFUmowa(false)
    setSearch('')
  }

  const filtered = useMemo(() => {
    return kontakty
      .filter(k => {
        if (typFilter      && k.typ          !== typFilter)      return false
        if (wojFilter      && k.wojewodztwo  !== wojFilter)      return false
        if (miastoFilter   && !k.miasto?.toLowerCase().includes(miastoFilter.toLowerCase())) return false
        if (assignedFilter && k.assigned_to  !== assignedFilter) return false

        if (search) {
          const q = search.toLowerCase()
          const hay = [k.nazwa, k.miasto, k.ulica, k.wojewodztwo, k.email, k.telefon, k.opis].join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }

        // Statusy realizacji
        if (fWizyta && !k.wizyta_osobista)    return false
        if (fMail   && !k.wyslany_mail_oferta) return false

        // Statusy wykonawcze
        if (fCoop     && !k.chec_wspolpracy)                return false
        if (fNie      && !k.niezainteresowani)              return false
        if (fUlotki   && !k.zgoda_ulotki)                   return false
        if (fPlakat   && !k.zgoda_plakat)                   return false
        if (fOperator && !k.operator_budowy_zainteresowani) return false

        // Dane kontaktu
        if (fGodziny  && !hasAnyHours(k.godziny_otwarcia)) return false
        if (fOtwarte  && isOpenNow(k.godziny_otwarcia) !== true) return false
        if (fTelefon  && !k.telefon?.trim())          return false
        if (fEmail    && !k.email?.trim())             return false
        if (fBezOpiek && k.assigned_to !== null)       return false
        if (fProwizja && !k.ustalona_prowizja?.trim()) return false
        if (fUmowa    && !k.umowa_url?.trim())         return false

        return true
      })
      .sort((a, b) => {
        let aV = '', bV = ''
        if      (sortKey === 'nazwa')       { aV = a.nazwa;                bV = b.nazwa }
        else if (sortKey === 'typ')         { aV = KONTAKT_TYP_LABELS[a.typ as KontaktTyp] || a.typ; bV = KONTAKT_TYP_LABELS[b.typ as KontaktTyp] || b.typ }
        else if (sortKey === 'wojewodztwo') { aV = a.wojewodztwo || '';    bV = b.wojewodztwo || '' }
        else if (sortKey === 'miasto')      { aV = a.miasto || '';         bV = b.miasto || '' }
        else if (sortKey === 'assignee')    { aV = a.assignee?.full_name || ''; bV = b.assignee?.full_name || '' }
        return sortDir === 'asc' ? aV.localeCompare(bV, 'pl') : bV.localeCompare(aV, 'pl')
      })
  }, [
    kontakty, typFilter, wojFilter, miastoFilter, assignedFilter, search,
    fWizyta, fMail, fCoop, fNie, fUlotki, fPlakat, fOperator,
    fGodziny, fOtwarte, fTelefon, fEmail, fBezOpiek, fProwizja, fUmowa,
    sortKey, sortDir,
  ])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-limona-border" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-limona-lime" />
      : <ChevronDown size={12} className="text-limona-lime" />
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted" />
          <input
            className="limona-input pl-9 w-full text-sm"
            placeholder="Szukaj po nazwie, mieście, adresie, telefonie, e-mailu…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'relative flex items-center gap-2 px-4 py-2 rounded text-sm border transition-colors uppercase tracking-wider font-medium',
            showFilters || activeFilterCount > 0
              ? 'border-limona-lime text-limona-lime bg-limona-lime/5'
              : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}
        >
          <Filter size={14} />
          Filtry
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-limona-lime text-black text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button onClick={onAdd} className="limona-btn flex items-center gap-2 text-sm">
          <Plus size={14} /> Dodaj kontakt
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="limona-card p-5 space-y-5">
          {/* Row 1: dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select className="limona-input text-sm" value={typFilter} onChange={e => setTypFilter(e.target.value)}>
              <option value="">Wszystkie typy</option>
              {visibleTypy.map(t => <option key={t} value={t}>{KONTAKT_TYP_LABELS[t]}</option>)}
            </select>
            <select className="limona-input text-sm" value={wojFilter} onChange={e => setWojFilter(e.target.value)}>
              <option value="">Wszystkie województwa</option>
              {WOJEWODZTWA.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <input
              className="limona-input text-sm"
              placeholder="Miasto…"
              value={miastoFilter}
              onChange={e => setMiastoFilter(e.target.value)}
            />
            <select className="limona-input text-sm" value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}>
              <option value="">Wszyscy opiekunowie</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>

          {/* Statusy realizacji */}
          <FilterSection title="Statusy realizacji">
            <FilterCheckbox label="Wizyta osobista"          checked={fWizyta} onChange={setFWizyta} />
            <FilterCheckbox label="Wysłany mail / oferta"    checked={fMail}   onChange={setFMail} />
          </FilterSection>

          {/* Statusy wykonawcze */}
          <FilterSection title="Statusy wykonawcze">
            <FilterCheckbox label="Chęć współpracy"          checked={fCoop}     onChange={setFCoop} />
            <FilterCheckbox label="Niezainteresowani"        checked={fNie}      onChange={setFNie} />
            <FilterCheckbox label="Zgoda na ulotki"          checked={fUlotki}   onChange={setFUlotki} />
            <FilterCheckbox label="Zgoda na plakat"          checked={fPlakat}   onChange={setFPlakat} />
            <FilterCheckbox label="Operator budowy (zainteresowani)" checked={fOperator} onChange={setFOperator} />
          </FilterSection>

          {/* Dane kontaktu */}
          <FilterSection title="Dane kontaktu">
            <FilterCheckbox label="🟢 Otwarte teraz"         checked={fOtwarte}  onChange={setFOtwarte} />
            <FilterCheckbox label="Ma godziny otwarcia"      checked={fGodziny}  onChange={setFGodziny} />
            <FilterCheckbox label="Ma telefon"               checked={fTelefon}  onChange={setFTelefon} />
            <FilterCheckbox label="Ma e-mail"                checked={fEmail}    onChange={setFEmail} />
            <FilterCheckbox label="Nieprzypisany (brak opiekuna)" checked={fBezOpiek} onChange={setFBezOpiek} />
            <FilterCheckbox label="Ma ustaloną prowizję"     checked={fProwizja} onChange={setFProwizja} />
            <FilterCheckbox label="Ma umowę (plik)"          checked={fUmowa}    onChange={setFUmowa} />
          </FilterSection>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs text-limona-text-muted hover:text-limona-red transition-colors"
            >
              <X size={12} /> Wyczyść wszystkie filtry
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-limona-border">
              {([
                ['nazwa',       'Nazwa'],
                ['typ',         'Typ'],
                ['wojewodztwo', 'Województwo'],
                ['miasto',      'Miasto'],
                ['assignee',    'Opiekun'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left py-3 px-3 text-xs uppercase tracking-wider text-limona-text-muted cursor-pointer select-none hover:text-limona-white transition-colors whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">{label} <SortIcon col={key} /></span>
                </th>
              ))}
              <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-limona-text-muted whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-limona-border/40">
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="py-3 px-3"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-limona-text-muted text-sm">
                  Brak kontaktów spełniających kryteria
                </td>
              </tr>
            ) : (
              filtered.map(k => {
                const openNow = isOpenNow(k.godziny_otwarcia)
                return (
                  <tr
                    key={k.id}
                    onClick={() => router.push(`/kontakty/${k.id}`)}
                    className="border-b border-limona-border/40 hover:bg-limona-surface-2 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-limona-white">{k.nazwa}</span>
                        {openNow === true  && <span title="Otwarte teraz" className="w-2 h-2 rounded-full bg-limona-green flex-shrink-0" />}
                        {openNow === false && hasAnyHours(k.godziny_otwarcia) && <span title="Zamknięte" className="w-2 h-2 rounded-full bg-limona-red/60 flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-limona-text-muted whitespace-nowrap">
                      {KONTAKT_TYP_LABELS[k.typ as KontaktTyp] || k.typ}
                    </td>
                    <td className="py-3 px-3 text-limona-text-muted">{k.wojewodztwo || '—'}</td>
                    <td className="py-3 px-3 text-limona-text-muted">{k.miasto || '—'}</td>
                    <td className="py-3 px-3">
                      {k.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={k.assignee.full_name} url={k.assignee.avatar_url} size="sm" />
                          <span className="text-limona-text text-xs truncate max-w-[100px]">{k.assignee.full_name}</span>
                        </div>
                      ) : <span className="text-limona-text-dim text-xs">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <CoopBadge kontakt={k} />
                        <div className="flex gap-1 ml-1">
                          <StatusDot active={k.wizyta_osobista}    label="Wizyta osobista" />
                          <StatusDot active={k.wyslany_mail_oferta} label="Mail z ofertą" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-limona-text-dim text-right">
          {filtered.length} z {kontakty.length} kontaktów
        </p>
      )}
    </div>
  )
}
