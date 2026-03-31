'use client'

import { useMemo, useState } from 'react'
import { calculateAbove, type Calc2Input, DEFAULT_WEIGHTS, type CreditorWeights } from '@/lib/calculator'
import { CalcResultCard, SummaryDecision } from './CalcResult'
import { formatMoney, formatPercent, cn } from '@/lib/utils'

interface Calculator2Props {
  input: Calc2Input
  onChange: (key: keyof Calc2Input, value: number | null) => void
  showInputs?: boolean
}

export function Calculator2({ input, onChange, showInputs = true }: Calculator2Props) {
  const [weights, setWeights] = useState<CreditorWeights>({ ...DEFAULT_WEIGHTS })

  const result = useMemo(() => {
    if (!input.valuePerSqm) return null
    return calculateAbove({ ...input, weights })
  }, [input, weights])

  function handleNum(key: keyof Calc2Input, val: string) {
    const n = parseFloat(val)
    onChange(key, isNaN(n) ? null : n)
  }

  return (
    <div className="space-y-6">
      {showInputs && (
        <div className="space-y-6">
          <div>
            <h3 className="limona-eyebrow mb-4">Dane podstawowe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="limona-label block mb-2">Wartość po najniższej m² (I) [zł]</label>
                <input type="number" className="limona-input" value={input.valuePerSqm || ''} onChange={e => handleNum('valuePerSqm', e.target.value)} placeholder="656000" min="0" step="1000" />
              </div>
              <div>
                <label className="limona-label block mb-2">Całk. zadłużenie (K) [zł]</label>
                <input type="number" className="limona-input" value={input.totalDebt || ''} onChange={e => handleNum('totalDebt', e.target.value)} placeholder="790000" min="0" step="1000" />
              </div>
              <div>
                <label className="limona-label block mb-2">Prowizja pośrednika (W) [%]</label>
                <input type="text" inputMode="decimal" className="limona-input"
                  value={input.commissionPct ? (input.commissionPct * 100).toString() : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(',', '.')
                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                      const v = parseFloat(raw); onChange('commissionPct', isNaN(v) ? 0 : v / 100)
                    }
                  }}
                  placeholder="2.46"
                />
              </div>
              <div>
                <label className="limona-label block mb-2">Taksa notarialna (Z) [zł]</label>
                <input type="number" className="limona-input" value={input.notaryFee || ''} onChange={e => handleNum('notaryFee', e.target.value)} placeholder="1000" min="0" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="limona-eyebrow mb-4">Wierzyciele</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="limona-label block mb-2">Kwota 1. wierzyciela (L) [zł]</label>
                <input type="number" className="limona-input" value={input.creditor1 || ''} onChange={e => handleNum('creditor1', e.target.value)} placeholder="600000" min="0" step="1000" />
              </div>
              <div>
                <label className="limona-label block mb-2">Kwota 2. wierzyciela (M) [zł]</label>
                <input type="number" className="limona-input" value={input.creditor2 || ''} onChange={e => handleNum('creditor2', e.target.value)} placeholder="150000" min="0" step="1000" />
              </div>
              <div>
                <label className="limona-label block mb-2">Kwota 3. wierzyciela (N) [zł]</label>
                <input type="number" className="limona-input" value={input.creditor3 || ''} onChange={e => handleNum('creditor3', e.target.value)} placeholder="40000" min="0" step="1000" />
              </div>
              <div>
                <label className="limona-label block mb-2">Wsp. właściciela (R)</label>
                <input type="number" className="limona-input"
                  value={input.ownerCoefficient || ''}
                  onChange={e => handleNum('ownerCoefficient', e.target.value)}
                  placeholder="0.025" min="0" max="1" step="0.001"
                />
                <span className="text-xs text-limona-text-dim">Domyślnie 0.025 = 2.5%</span>
              </div>
              <div className="sm:col-span-2">
                <label className="limona-label block mb-2">Ręczna oferta max (AF) [zł] — opcjonalnie</label>
                <input type="number" className="limona-input"
                  value={input.manualOffer || ''}
                  onChange={e => { const v = parseFloat(e.target.value); onChange('manualOffer', isNaN(v) ? null : v) }}
                  placeholder="500000" min="0" step="1000"
                />
              </div>
            </div>
          </div>

          {/* Weights configuration */}
          <div className="limona-card-accent p-4">
            <h3 className="limona-eyebrow mb-3">Wagi podziału wierzycieli</h3>
            <p className="text-xs text-limona-text-muted mb-4">
              Wierzyciel z największym udziałem dostaje relatywnie więcej. Suma wag nie musi być równa 3.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {([
                { key: 'largest' as keyof CreditorWeights, label: 'Największy' },
                { key: 'middle' as keyof CreditorWeights, label: 'Średni' },
                { key: 'smallest' as keyof CreditorWeights, label: 'Najmniejszy' },
              ] as const).map(w => (
                <div key={w.key}>
                  <label className="block text-xs text-limona-text-muted mb-1 uppercase tracking-wider">{w.label}</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.05"
                      value={weights[w.key]}
                      onChange={e => setWeights(prev => ({ ...prev, [w.key]: parseFloat(e.target.value) }))}
                    />
                    <span className="text-xs font-mono text-limona-lime">{weights[w.key].toFixed(2)}×</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
              className="mt-3 text-xs text-limona-text-dim hover:text-limona-text-muted transition-colors uppercase tracking-wider"
            >
              Przywróć domyślne (1.3 / 1.0 / 0.7)
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result ? (
        <div className="space-y-6">
          <div>
            <h3 className="limona-eyebrow mb-4">Wyniki — Oferta −30%</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <CalcResultCard label="RW (J)" value={formatMoney(result.rw)} sublabel="= I × 0.9" variant="neutral" />
              <CalcResultCard label="Pula oferty (X)" value={formatMoney(result.offerMinus30)} sublabel="= J × 0.7" variant="neutral" />
              <CalcResultCard label="Oferta właściciela (V)" value={formatMoney(result.ownerOffer)} sublabel={`= X × ${((input.ownerCoefficient || 0.025) * 100).toFixed(1)}%`} variant="neutral" />
              <CalcResultCard label="PCC (Y)" value={formatMoney(result.pcc)} sublabel="= X × 2%" variant="neutral" />
              <CalcResultCard label="Koszty (AA)" value={formatMoney(result.costs)} sublabel="= X + prow. + PCC + taksa" variant="neutral" />
              <CalcResultCard label="Wkład (AB)" value={formatMoney(result.investment)} variant="neutral" />
            </div>

            {/* Creditor breakdown */}
            {(input.creditor1 || input.creditor2 || input.creditor3) && (
              <div className="mt-4 limona-card p-4">
                <h4 className="text-xs uppercase tracking-wider text-limona-text-muted mb-3">Podział dla wierzycieli</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Wierzyciel 1', amount: result.creditor1Offer, bd: result.creditorBreakdown[0], total: input.creditor1 || 0 },
                    { label: 'Wierzyciel 2', amount: result.creditor2Offer, bd: result.creditorBreakdown[1], total: input.creditor2 || 0 },
                    { label: 'Wierzyciel 3', amount: result.creditor3Offer, bd: result.creditorBreakdown[2], total: input.creditor3 || 0 },
                  ].filter(c => c.total > 0).map(c => (
                    <div key={c.label} className="flex items-center gap-3">
                      <span className="text-xs text-limona-text-muted w-24">{c.label}</span>
                      <div className="flex-1 bg-limona-border/30 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-limona-lime"
                          style={{ width: `${(c.bd.normalizedShare * 100).toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-limona-lime w-28 text-right">{formatMoney(c.amount)}</span>
                      <span className="text-xs text-limona-text-dim w-16 text-right">
                        {(c.bd.normalizedShare * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-limona-text-dim w-12 text-right">
                        ×{c.bd.weight.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-limona-text-dim mt-3">
                  Suma: Właściciel {formatMoney(result.ownerOffer)} + Wierzyciele{' '}
                  {formatMoney(result.creditor1Offer + result.creditor2Offer + result.creditor3Offer)} ={' '}
                  {formatMoney(result.offerMinus30)}
                </p>
              </div>
            )}

            <div className="mt-4">
              <SummaryDecision profit={result.profit} roi={result.roi} decision={result.decision} label="Decyzja — wariant standardowy" />
            </div>
          </div>

          {/* Manual offer variant */}
          {result.manual && (
            <div>
              <h3 className="limona-eyebrow mb-4">Wariant z ręczną ofertą max (AF = {formatMoney(result.manual.maxOffer)})</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <CalcResultCard label="Oferta właściciela (AJ)" value={formatMoney(result.manual.ownerOffer)} sublabel={`= AF × ${((input.ownerCoefficient || 0.025) * 100).toFixed(1)}%`} variant="neutral" />
                <CalcResultCard label="Wierzyciel 1 (AG)" value={formatMoney(result.manual.creditor1Offer)} variant="neutral" />
                <CalcResultCard label="Wierzyciel 2 (AH)" value={formatMoney(result.manual.creditor2Offer)} variant="neutral" />
                <CalcResultCard label="Wierzyciel 3 (AI)" value={formatMoney(result.manual.creditor3Offer)} variant="neutral" />
                <CalcResultCard label="PCC (AK)" value={formatMoney(result.manual.pcc)} variant="neutral" />
                <CalcResultCard label="Koszty (AM)" value={formatMoney(result.manual.costs)} variant="neutral" />
              </div>

              <div className="mt-4">
                <SummaryDecision
                  profit={result.manual.profit}
                  roi={result.manual.roi}
                  decision={result.manual.decision}
                  label="Decyzja — ręczna oferta max"
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
