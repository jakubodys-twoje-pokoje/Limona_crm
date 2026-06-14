'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Plus, ExternalLink, Edit, Trash2 } from 'lucide-react'
import type { Property, PropertyStatus, PropertyType, DealType } from '@/types/database'
import { DEAL_TYPE_SHORT } from '@/lib/stages'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { calculateBelow, calculateAbove } from '@/lib/calculator'
import { formatMoney, formatPercent, cn } from '@/lib/utils'

type SortKey = 'location' | 'value_per_sqm' | 'rw' | 'total_debt' | 'profit' | 'roi' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

interface PropertiesTableProps {
  properties: Property[]
  loading: boolean
  onAddWithCalc: () => void
  onAddWithoutCalc: () => void
  onEdit: (p: Property) => void
  onDelete: (p: Property) => void
}

function calcProfit(p: Property): number | null {
  if (!p.value_per_sqm) return null
  try {
    if (p.debt_type === 'above_value') {
      const r = calculateAbove({
        valuePerSqm: p.value_per_sqm,
        totalDebt: p.total_debt || 0,
        creditor1: p.creditor1_amount || 0,
        creditor2: p.creditor2_amount || 0,
        creditor3: p.creditor3_amount || 0,
        ownerCoefficient: p.owner_coefficient || 0.025,
        commissionPct: (p.commission_pct || 0) / 100,
        notaryFee: p.notary_fee || 1000,
        manualOffer: p.manual_offer,
      })
      return p.manual_offer ? r.manual?.profit ?? r.profit : r.profit
    } else {
      const r = calculateBelow({
        valuePerSqm: p.value_per_sqm,
        totalDebt: p.total_debt || 0,
        commissionPct: (p.commission_pct || 0) / 100,
        notaryFee: p.notary_fee || 1000,
        manualOffer: p.manual_offer,
      })
      return p.manual_offer ? r.manual?.profit ?? r.profit : r.profit
    }
  } catch { return null }
}

function calcROI(p: Property): number | null {
  if (!p.value_per_sqm) return null
  try {
    if (p.debt_type === 'above_value') {
      const r = calculateAbove({
        valuePerSqm: p.value_per_sqm,
        totalDebt: p.total_debt || 0,
        creditor1: p.creditor1_amount || 0,
        creditor2: p.creditor2_amount || 0,
        creditor3: p.creditor3_amount || 0,
        ownerCoefficient: p.owner_coefficient || 0.025,
        commissionPct: (p.commission_pct || 0) / 100,
        notaryFee: p.notary_fee || 1000,
        manualOffer: p.manual_offer,
      })
      return p.manual_offer ? r.manual?.roi ?? r.roi : r.roi
    } else {
      const r = calculateBelow({
        valuePerSqm: p.value_per_sqm,
        totalDebt: p.total_debt || 0,
        commissionPct: (p.commission_pct || 0) / 100,
        notaryFee: p.notary_fee || 1000,
        manualOffer: p.manual_offer,
      })
      return p.manual_offer ? r.manual?.roi ?? r.roi : r.roi
    }
  } catch { return null }
}

function getDecision(p: Property): 'OK' | 'NIE' | null {
  const profit = calcProfit(p)
  const roi = calcROI(p)
  if (profit == null) return null
  return (profit >= 120000 || (roi != null && roi >= 0.36)) ? 'OK' : 'NIE'
}

function getOfferMinus30(p: Property): number | null {
  if (!p.value_per_sqm) return null
  const rw = p.value_per_sqm * 0.9
  return rw * 0.7
}

export function PropertiesTable({ properties, loading, onAddWithCalc, onAddWithoutCalc, onEdit, onDelete }: PropertiesTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [decisionFilter, setDecisionFilter] = useState<string>('')
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtered = useMemo(() => {
    return properties
      .filter(p => {
        if (search && !p.location.toLowerCase().includes(search.toLowerCase())) return false
        if (statusFilter && p.status !== statusFilter) return false
        if (typeFilter && p.property_type !== typeFilter) return false
        if (dealTypeFilter && p.deal_type !== dealTypeFilter) return false
        if (decisionFilter) {
          const dec = getDecision(p)
          if (dec !== decisionFilter) return false
        }
        return true
      })
      .sort((a, b) => {
        let aVal: number | string = 0
        let bVal: number | string = 0
        switch (sortKey) {
          case 'location': aVal = a.location; bVal = b.location; break
          case 'value_per_sqm': aVal = a.value_per_sqm || 0; bVal = b.value_per_sqm || 0; break
          case 'rw': aVal = a.rw || 0; bVal = b.rw || 0; break
          case 'total_debt': aVal = a.total_debt || 0; bVal = b.total_debt || 0; break
          case 'profit': aVal = calcProfit(a) ?? -Infinity; bVal = calcProfit(b) ?? -Infinity; break
          case 'roi': aVal = calcROI(a) ?? -Infinity; bVal = calcROI(b) ?? -Infinity; break
          case 'status': aVal = a.status; bVal = b.status; break
          case 'created_at': aVal = a.created_at; bVal = b.created_at; break
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [properties, search, statusFilter, typeFilter, decisionFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-limona-text-dim" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-limona-lime" />
      : <ArrowDown size={12} className="text-limona-lime" />
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="limona-card h-16 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-muted" />
          <input
            className="limona-input pl-9"
            placeholder="Szukaj lokalizacji..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            className="bg-limona-surface-2 border border-limona-border text-limona-text text-xs px-3 py-2 rounded focus:outline-none focus:border-limona-lime"
            value={dealTypeFilter}
            onChange={e => setDealTypeFilter(e.target.value)}
          >
            <option value="">Wszystkie typy deal</option>
            <option value="zadluzony_ponizej">Poniżej wartości</option>
            <option value="zadluzony_powyzej">Powyżej wartości</option>
            <option value="savedeal">SaveDeal</option>
          </select>

          <select
            className="bg-limona-surface-2 border border-limona-border text-limona-text text-xs px-3 py-2 rounded focus:outline-none focus:border-limona-lime"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Wszystkie statusy</option>
            <optgroup label="Poniżej wartości">
              <option value="nowa">Nowa</option>
              <option value="analiza">Analiza</option>
              <option value="oferta">Oferta wysłana</option>
              <option value="umowa_przedwstepna_kupna">Umowa przedw. kupna</option>
              <option value="umowa_kupna">Umowa kupna</option>
              <option value="zaplata_ceny">Zapłata ceny</option>
              <option value="odebranie_posiadania">Odebranie posiadania</option>
              <option value="odswiezenie">Odświeżenie</option>
              <option value="reklama_sprzedazy">Reklama sprzedaży</option>
              <option value="pokazywanie">Pokazywanie</option>
              <option value="umowa_przedwstepna_sprzedazy">Umowa przedw. sprzedaży</option>
              <option value="sprzedaz">Sprzedaż</option>
            </optgroup>
            <optgroup label="Powyżej wartości (extra)">
              <option value="negocjacje_wierzyciele">Negocjacje wierzyciele</option>
              <option value="akt_nabycia">Akt nabycia</option>
              <option value="wynajem">Wynajem</option>
            </optgroup>
            <optgroup label="SaveDeal (extra)">
              <option value="umowa_savedeal">Umowa SaveDeal</option>
              <option value="wycena">Wycena</option>
            </optgroup>
            <optgroup label="Końcowe">
              <option value="zakonczona">Zakończona</option>
              <option value="rejected">Odrzucona</option>
            </optgroup>
            <optgroup label="Legacy">
              <option value="new">Nowa (legacy)</option>
              <option value="analysis">Analiza (legacy)</option>
              <option value="offer_sent">Oferta (legacy)</option>
              <option value="negotiation">Negocjacja (legacy)</option>
              <option value="contract">Umowa (legacy)</option>
              <option value="legal_cleanup">Regulacja (legacy)</option>
              <option value="sale">Sprzedaż (legacy)</option>
              <option value="completed">Zakończona (legacy)</option>
            </optgroup>
          </select>

          <select
            className="bg-limona-surface-2 border border-limona-border text-limona-text text-xs px-3 py-2 rounded focus:outline-none focus:border-limona-lime"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">Wszystkie typy</option>
            <option value="mieszkanie">Mieszkanie</option>
            <option value="dom">Dom</option>
            <option value="grunt">Grunt</option>
            <option value="hala">Hala</option>
            <option value="inne">Inne</option>
          </select>

          <select
            className="bg-limona-surface-2 border border-limona-border text-limona-text text-xs px-3 py-2 rounded focus:outline-none focus:border-limona-lime"
            value={decisionFilter}
            onChange={e => setDecisionFilter(e.target.value)}
          >
            <option value="">Decyzja: wszystkie</option>
            <option value="OK">OK</option>
            <option value="NIE">NIE</option>
          </select>

          <div className="flex items-center gap-1">
            <button onClick={onAddWithCalc} className="limona-btn-sm whitespace-nowrap flex items-center gap-2">
              <Plus size={14} />
              Dodaj
            </button>
            <button
              onClick={onAddWithoutCalc}
              className="text-[10px] text-limona-text-dim hover:text-limona-text-muted transition-colors uppercase tracking-wider whitespace-nowrap px-2 py-1"
              title="Dodaj bez kalkulatora"
            >
              bez kalk.
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="text-xs text-limona-text-muted">
        {filtered.length} z {properties.length} nieruchomości
        {filtered.filter(p => getDecision(p) === 'OK').length > 0 && (
          <span className="ml-3 text-limona-green font-mono">
            ✓ {filtered.filter(p => getDecision(p) === 'OK').length} OK
          </span>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-limona-border">
              {[
                { key: 'location' as SortKey, label: 'Lokalizacja' },
                { key: 'value_per_sqm' as SortKey, label: 'Wartość (I)' },
                { key: 'rw' as SortKey, label: 'RW (J)' },
                { key: 'total_debt' as SortKey, label: 'Zadłużenie' },
                { key: 'profit' as SortKey, label: 'Oferta -30%' },
                { key: 'profit' as SortKey, label: 'Zysk' },
                { key: 'roi' as SortKey, label: 'ROI' },
                { key: 'status' as SortKey, label: 'Decyzja' },
                { key: 'status' as SortKey, label: 'Status' },
              ].map((col, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(col.key)}
                  className="text-left py-3 px-3 text-xs uppercase tracking-wider text-limona-text-muted cursor-pointer hover:text-limona-text select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon k={col.key} />
                  </span>
                </th>
              ))}
              <th className="py-3 px-3 text-left text-xs uppercase tracking-wider text-limona-text-muted">
                Przypisany
              </th>
              <th className="py-3 px-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-limona-text-muted">
                  Brak nieruchomości — dodaj pierwszą!
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const profit = calcProfit(p)
                const roi = calcROI(p)
                const decision = getDecision(p)
                const offerMinus30 = getOfferMinus30(p)
                const rw = p.value_per_sqm ? p.value_per_sqm * 0.9 : null

                return (
                  <tr
                    key={p.id}
                    className="border-b border-limona-border/50 hover:bg-limona-surface-2/50 transition-colors group"
                  >
                    <td className="py-3 px-3">
                      <Link href={`/nieruchomosci/${p.id}`} className="hover:text-limona-lime transition-colors font-medium">
                        {p.location}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.property_type && (
                          <span className="text-xs text-limona-text-dim capitalize">{p.property_type}</span>
                        )}
                        {p.deal_type && (
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            p.deal_type === 'zadluzony_ponizej' ? 'bg-limona-blue/15 text-limona-blue' :
                            p.deal_type === 'zadluzony_powyzej' ? 'bg-limona-yellow/15 text-limona-yellow' :
                            'bg-limona-lime/15 text-limona-lime'
                          )}>
                            {DEAL_TYPE_SHORT[p.deal_type as DealType]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">{formatMoney(p.value_per_sqm)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-limona-text-muted">{formatMoney(rw)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-limona-yellow">{formatMoney(p.total_debt)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-limona-text-muted">{formatMoney(offerMinus30)}</td>
                    <td className="py-3 px-3 font-mono text-xs">
                      <span className={cn(
                        profit != null && profit >= 120000 ? 'text-limona-green' : 'text-limona-red'
                      )}>
                        {formatMoney(profit)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      <span className={cn(
                        roi != null && roi >= 0.36 ? 'text-limona-green' : 'text-limona-red'
                      )}>
                        {formatPercent(roi)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {decision ? (
                        <Badge value={decision} />
                      ) : <span className="text-limona-text-dim">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <Badge value={p.status} />
                    </td>
                    <td className="py-3 px-3">
                      {p.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={p.assignee.full_name} url={p.assignee.avatar_url} size="sm" />
                          <span className="text-xs text-limona-text-muted hidden xl:block">
                            {p.assignee.full_name.split(' ')[0]}
                          </span>
                        </div>
                      ) : <span className="text-limona-text-dim text-xs">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/nieruchomosci/${p.id}`}
                          className="p-1.5 text-limona-text-muted hover:text-limona-lime transition-colors"
                          title="Otwórz"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          onClick={() => onEdit(p)}
                          className="p-1.5 text-limona-text-muted hover:text-limona-lime transition-colors"
                          title="Edytuj"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(p)}
                          className="p-1.5 text-limona-text-muted hover:text-limona-red transition-colors"
                          title="Usuń"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-limona-text-muted py-12">
            Brak nieruchomości — dodaj pierwszą!
          </div>
        ) : (
          filtered.map(p => {
            const profit = calcProfit(p)
            const roi = calcROI(p)
            const decision = getDecision(p)

            return (
              <Link key={p.id} href={`/nieruchomosci/${p.id}`}>
                <div className="limona-card-hover border-l-[3px] border-l-limona-border hover:border-l-limona-lime p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-limona-white">{p.location}</p>
                      {p.property_type && (
                        <span className="text-xs text-limona-text-dim capitalize">{p.property_type}</span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {decision && <Badge value={decision} />}
                      <Badge value={p.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-limona-text-muted block">Wartość</span>
                      <span className="font-mono text-limona-text">{formatMoney(p.value_per_sqm)}</span>
                    </div>
                    <div>
                      <span className="text-limona-text-muted block">Zysk</span>
                      <span className={cn('font-mono', profit != null && profit >= 120000 ? 'text-limona-green' : 'text-limona-red')}>
                        {formatMoney(profit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-limona-text-muted block">ROI</span>
                      <span className={cn('font-mono', roi != null && roi >= 0.36 ? 'text-limona-green' : 'text-limona-red')}>
                        {formatPercent(roi)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
