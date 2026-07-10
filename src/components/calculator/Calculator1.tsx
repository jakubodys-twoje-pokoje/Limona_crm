'use client'

import { useMemo } from 'react'
import { calculateBelow, type Calc1Input } from '@/lib/calculator'
import { CalcResultCard, SummaryDecision } from './CalcResult'
import { formatMoney, formatPercent } from '@/lib/utils'

interface Calculator1Props {
  input: Calc1Input
  onChange: (key: keyof Calc1Input, value: number | null) => void
  showInputs?: boolean
}

export function Calculator1({ input, onChange, showInputs = true }: Calculator1Props) {
  const result = useMemo(() => {
    if (!input.valuePerSqm) return null
    return calculateBelow(input)
  }, [input])

  function handleNum(key: keyof Calc1Input, val: string) {
    const n = parseFloat(val)
    onChange(key, isNaN(n) ? null : n)
  }

  return (
    <div className="space-y-6">
      {showInputs && (
        <div>
          <h3 className="limona-eyebrow mb-4">Dane wejściowe</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="limona-label block mb-2">Wartość po najniższej m² (I) [zł]</label>
              <input
                type="number"
                className="limona-input"
                value={input.valuePerSqm || ''}
                onChange={e => handleNum('valuePerSqm', e.target.value)}
                placeholder="656000"
                min="0"
                step="1000"
              />
              <p className="text-[11px] text-limona-text-dim mt-1">Wartość rynkowa nieruchomości wg najniższej wyceny. Stąd liczymy RW = I × 90%.</p>
            </div>
            <div>
              <label className="limona-label block mb-2">Zadłużenie (K) [zł]</label>
              <input
                type="number"
                className="limona-input"
                value={input.totalDebt || ''}
                onChange={e => handleNum('totalDebt', e.target.value)}
                placeholder="0"
                min="0"
                step="1000"
              />
              <p className="text-[11px] text-limona-text-dim mt-1">Łączna kwota wszystkich zobowiązań: hipoteki, zaległości, komornik.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="limona-label block mb-2">Suma kosztów dodatkowych [zł]</label>
              <input
                type="number"
                className="limona-input"
                value={input.additionalCosts || ''}
                onChange={e => handleNum('additionalCosts', e.target.value)}
                placeholder="np. 20000"
                min="0"
                step="100"
              />
              <p className="text-[11px] text-limona-text-dim mt-1">Suma wszystkich kosztów dodatkowych: taksa notarialna, prowizja pośrednika, itd.</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result ? (
        <div className="space-y-6">
          <div>
            <h3 className="limona-eyebrow mb-4">Wyniki — Wariant standardowy</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <CalcResultCard label="RW (J)" value={formatMoney(result.rw)} sublabel="= I × 0.9" variant="neutral" />
              <CalcResultCard label="Oferta −30% (M)" value={formatMoney(result.offerMinus30)} sublabel="= J × 0.7" variant="neutral" />
              <CalcResultCard label="PCC (N)" value={formatMoney(result.pcc)} sublabel="= (M+K) × 2%" variant="neutral" />
              <CalcResultCard label="Koszty (P)" value={formatMoney(result.costs)} sublabel="= M + PCC + koszty dod." variant="neutral" />
              <CalcResultCard label="Wkład (Q)" value={formatMoney(result.investment)} variant="neutral" />
            </div>

            <div className="mt-4">
              <SummaryDecision profit={result.profit} roi={result.roi} decision={result.decision} label="Decyzja" />
            </div>
          </div>
        </div>
      ) : (
        <div className="limona-card p-8 text-center">
          <p className="text-limona-text-muted">Wpisz wartość nieruchomości (I), aby zobaczyć wyniki</p>
        </div>
      )}
    </div>
  )
}
