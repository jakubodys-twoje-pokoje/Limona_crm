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
            </div>
            <div>
              <label className="limona-label block mb-2">Prowizja pośrednika (L) [%]</label>
              <input
                type="text"
                inputMode="decimal"
                className="limona-input"
                value={input.commissionPct ? (input.commissionPct * 100).toString() : ''}
                onChange={e => {
                  const raw = e.target.value.replace(',', '.')
                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                    const v = parseFloat(raw)
                    onChange('commissionPct', isNaN(v) ? 0 : v / 100)
                  }
                }}
                placeholder="2.46"
              />
            </div>
            <div>
              <label className="limona-label block mb-2">Taksa notarialna (O) [zł]</label>
              <input
                type="number"
                className="limona-input"
                value={input.notaryFee || ''}
                onChange={e => handleNum('notaryFee', e.target.value)}
                placeholder="1000"
                min="0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="limona-label block mb-2">Ręczna oferta (U) [zł] — opcjonalnie</label>
              <input
                type="number"
                className="limona-input"
                value={input.manualOffer || ''}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  onChange('manualOffer', isNaN(v) ? null : v)
                }}
                placeholder="445000"
                min="0"
                step="1000"
              />
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
              <CalcResultCard label="Koszty (P)" value={formatMoney(result.costs)} sublabel="= M + prow. + PCC + taksa" variant="neutral" />
              <CalcResultCard label="Wkład (Q)" value={formatMoney(result.investment)} variant="neutral" />
            </div>

            <div className="mt-4">
              <SummaryDecision profit={result.profit} roi={result.roi} decision={result.decision} label="Decyzja — wariant standardowy" />
            </div>
          </div>

          {result.manual && (
            <div>
              <h3 className="limona-eyebrow mb-4">Wariant z ręczną ofertą (U = {formatMoney(result.manual.maxOffer)})</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <CalcResultCard label="Pierwsza oferta (C)" value={formatMoney(result.manual.firstOffer)} sublabel="= U × 0.85" variant="neutral" />
                <CalcResultCard label="Max oferta (D)" value={formatMoney(result.manual.maxOffer)} variant="neutral" />
                <CalcResultCard label="PCC (V)" value={formatMoney(result.manual.pcc)} sublabel="= U × 2%" variant="neutral" />
                <CalcResultCard label="Koszty (X)" value={formatMoney(result.manual.costs)} sublabel="= U + prow. + PCC + taksa" variant="neutral" />
                <CalcResultCard label="Wkład (Y)" value={formatMoney(result.manual.investment)} variant="neutral" />
              </div>

              <div className="mt-4">
                <SummaryDecision
                  profit={result.manual.profit}
                  roi={result.manual.roi}
                  decision={result.manual.decision}
                  label="Decyzja — ręczna oferta"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="limona-card p-8 text-center">
          <p className="text-limona-text-muted">Wpisz wartość nieruchomości (I), aby zobaczyć wyniki</p>
        </div>
      )}
    </div>
  )
}
