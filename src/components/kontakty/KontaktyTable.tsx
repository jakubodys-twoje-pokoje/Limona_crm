'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, ChevronUp, ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
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
  if (kontakt.chec_wspolpracy)  return <span className="limona-badge text-[10px] bg-limona-lime/10 text-limona-lime border-limona-lime/30">Współpraca</span>
  if (kontakt.niezainteresowani) return <span className="limona-badge text-[10px] bg-limona-red/10 text-limona-red border-limona-red/30">Niezainteresowani</span>
  return <span className="limona-badge text-[10px] text-limona-text-muted border-limona-border">Brak danych</span>
}

export function KontaktyTable({ kontakty, loading, profiles, onAdd }: Props) {
  const router = useRouter()

  const [search, setSearch]             = useState('')
  const [typFilter, setTypFilter]       = useState('')
  const [wojFilter, setWojFilter]       = useState('')
  const [miastoFilter, setMiastoFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [showFilters, setShowFilters]   = useState(false)

  // Boolean status filters
  const [fWizyta, setFWizyta]       = useState(false)
  const [fMail, setFMail]           = useState(false)
  const [fCoop, setFCoop]           = useState(false)
  const [fNie, setFNie]             = useState(false)
  const [fUlotki, setFUlotki]       = useState(false)
  const [fPlakat, setFPlakat]       = useState(false)
  const [fOperator, setFOperator]   = useState(false)

  const [sortKey, setSortKey]   = useState<SortKey>('nazwa')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    return kontakty
      .filter(k => {
        if (typFilter && k.typ !== typFilter) return false
        if (wojFilter && k.wojewodztwo !== wojFilter) return false
        if (miastoFilter && !k.miasto?.toLowerCase().includes(miastoFilter.toLowerCase())) return false
        if (assignedFilter && k.assigned_to !== assignedFilter) return false
        if (search) {
          const q = search.toLowerCase()
          const haystack = [k.nazwa, k.miasto, k.ulica, k.wojewodztwo].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        if (fWizyta   && !k.wizyta_osobista)   return false
        if (fMail     && !k.wyslany_mail_oferta) return false
        if (fCoop     && !k.chec_wspolpracy)   return false
        if (fNie      && !k.niezainteresowani) return false
        if (fUlotki   && !k.zgoda_ulotki)      return false
        if (fPlakat   && !k.zgoda_plakat)      return false
        if (fOperator && !k.operator_budowy_zainteresowani) return false
        return true
      })
      .sort((a, b) => {
        let aVal = '', bVal = ''
        if (sortKey === 'nazwa')      { aVal = a.nazwa; bVal = b.nazwa }
        else if (sortKey === 'typ')   { aVal = KONTAKT_TYP_LABELS[a.typ as KontaktTyp] || a.typ; bVal = KONTAKT_TYP_LABELS[b.typ as KontaktTyp] || b.typ }
        else if (sortKey === 'wojewodztwo') { aVal = a.wojewodztwo || ''; bVal = b.wojewodztwo || '' }
        else if (sortKey === 'miasto')     { aVal = a.miasto || ''; bVal = b.miasto || '' }
        else if (sortKey === 'assignee')   { aVal = a.assignee?.full_name || ''; bVal = b.assignee?.full_name || '' }
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'pl') : bVal.localeCompare(aVal, 'pl')
      })
  }, [kontakty, typFilter, wojFilter, miastoFilter, assignedFilter, search,
      fWizyta, fMail, fCoop, fNie, fUlotki, fPlakat, fOperator, sortKey, sortDir])

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
            placeholder="Szukaj po nazwie, mieście, adresie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded text-sm border transition-colors uppercase tracking-wider font-medium',
            showFilters
              ? 'border-limona-lime text-limona-lime bg-limona-lime/5'
              : 'border-limona-border text-limona-text-muted hover:border-limona-text-muted'
          )}
        >
          <Filter size={14} /> Filtry
        </button>
        <button onClick={onAdd} className="limona-btn flex items-center gap-2 text-sm">
          <Plus size={14} /> Dodaj kontakt
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="limona-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select className="limona-input text-sm" value={typFilter} onChange={e => setTypFilter(e.target.value)}>
              <option value="">Wszystkie typy</option>
              {KONTAKT_TYPY.map(t => (
                <option key={t} value={t}>{KONTAKT_TYP_LABELS[t]}</option>
              ))}
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
          <div className="flex flex-wrap gap-3 pt-1">
            {([
              [fWizyta,   setFWizyta,   'Wizyta osobista'],
              [fMail,     setFMail,     'Mail z ofertą'],
              [fCoop,     setFCoop,     'Chęć współpracy'],
              [fNie,      setFNie,      'Niezainteresowani'],
              [fUlotki,   setFUlotki,   'Zgoda na ulotki'],
              [fPlakat,   setFPlakat,   'Zgoda na plakat'],
              [fOperator, setFOperator, 'Operator budowy'],
            ] as [boolean, (v: boolean) => void, string][]).map(([val, set, label]) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer text-sm text-limona-text-muted hover:text-limona-white transition-colors">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => set(e.target.checked)}
                  className="accent-[#BEFF00] w-3.5 h-3.5"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-limona-border">
              {([
                ['nazwa',      'Nazwa'],
                ['typ',        'Typ'],
                ['wojewodztwo','Województwo'],
                ['miasto',     'Miasto'],
                ['assignee',   'Opiekun'],
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
              <th className="py-3 px-3 text-xs uppercase tracking-wider text-limona-text-muted text-center">
                Działania
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-limona-border/40">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="py-3 px-3"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-limona-text-muted text-sm">
                  Brak kontaktów spełniających kryteria
                </td>
              </tr>
            ) : (
              filtered.map(k => (
                <tr
                  key={k.id}
                  onClick={() => router.push(`/kontakty/${k.id}`)}
                  className="border-b border-limona-border/40 hover:bg-limona-surface-2 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-medium text-limona-white">{k.nazwa}</td>
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
                        <StatusDot active={k.wizyta_osobista}   label="Wizyta osobista" />
                        <StatusDot active={k.wyslany_mail_oferta} label="Mail z ofertą" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-xs text-limona-text-muted">→</span>
                  </td>
                </tr>
              ))
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
