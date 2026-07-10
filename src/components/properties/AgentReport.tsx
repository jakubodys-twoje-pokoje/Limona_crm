'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Property } from '@/types/database'

interface AgentReportProps {
  property: Property
}

interface CalcResult {
  cena: number
  dlugTot: number
  odsB: number
  odsU: number
  odsTot: number
  oplata: number
  prowizja: number
  potranienia: number
  wynik: number
}

function calcProwizja(cena: number): number {
  return cena < 1_000_000 ? 12_300 : 24_600
}

function calcSciezka(params: {
  cenaSprzedazy: number
  dlugBank: number
  dlugUrzad: number
  msc: number
  typ: 'limona' | 'lic'
}): CalcResult {
  const { cenaSprzedazy: c, dlugBank: dB, dlugUrzad: dU, msc: m, typ } = params
  const odsB = dB * 0.185 * (m / 12)
  const odsU = dU * 0.105 * (m / 12)
  const odsTot = odsB + odsU
  const dlugTot = dB + dU
  if (typ === 'limona') {
    const prow = calcProwizja(c)
    return {
      cena: c, dlugTot, odsB: 0, odsU: 0, odsTot: 0, oplata: 0,
      prowizja: prow, potranienia: dlugTot + prow, wynik: c - dlugTot - prow,
    }
  } else {
    const oplata = odsTot * 0.1
    const pot = dlugTot + odsTot + oplata
    return {
      cena: c, dlugTot, odsB, odsU, odsTot, oplata, prowizja: 0,
      potranienia: pot, wynik: c - pot,
    }
  }
}

function fmt(v: number): string {
  if (v === 0) return '0 zł'
  const abs = Math.abs(Math.round(v))
  const sign = v < 0 ? '– ' : ''
  return sign + abs.toLocaleString('pl-PL') + ' zł'
}

function fmtNeg(v: number): string {
  return '– ' + Math.round(Math.abs(v)).toLocaleString('pl-PL') + ' zł'
}

function NumInput({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-bold text-limona-text-muted">{label}</label>
      <div className="flex items-center limona-input p-0 overflow-hidden">
        <input
          type="number"
          min={0}
          step={1000}
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-transparent outline-none px-3 py-2 text-sm text-limona-white font-mono w-0 min-w-0"
        />
        <span className="px-3 text-xs text-limona-text-dim border-l border-limona-border bg-limona-surface-2 self-stretch flex items-center">zł</span>
      </div>
      {hint && <p className="text-[10px] text-limona-text-dim">{hint}</p>}
    </div>
  )
}

interface ResultRowProps { label: string; sub?: string; value: string; valueClass?: string }
function ResultRow({ label, sub, value, valueClass = 'text-limona-text' }: ResultRowProps) {
  return (
    <tr className="border-b border-limona-border/40 last:border-0">
      <td className="py-2 px-3 text-sm text-limona-text-muted align-top">
        {label}
        {sub && <span className="block text-[10px] text-limona-text-dim mt-0.5">{sub}</span>}
      </td>
      <td className={cn('py-2 px-3 text-sm text-right font-mono whitespace-nowrap', valueClass)}>{value}</td>
    </tr>
  )
}

export function AgentReport({ property }: AgentReportProps) {
  const marketValue = property.value_per_sqm || 0
  const operatDefault = property.wycena_szacunkowa ? Number(property.wycena_szacunkowa) : marketValue
  const totalDebt = property.total_debt || 0
  const defaultLimona = Math.round(marketValue * 0.8)

  const [wartoscRynkowa, setWartoscRynkowa] = useState(marketValue)
  const [cenaLimona, setCenaLimona] = useState(defaultLimona)
  const [operatVal, setOperatVal] = useState(operatDefault)
  const [dlugBank, setDlugBank] = useState(totalDebt)
  const [dlugUrzad, setDlugUrzad] = useState(0)
  const [msc, setMsc] = useState(24)
  const [licFrac, setLicFrac] = useState(0.75)

  const cenaLic1 = operatVal * 0.75
  const cenaLic2 = operatVal * 0.6667

  const rL = useMemo(
    () => calcSciezka({ cenaSprzedazy: cenaLimona, dlugBank, dlugUrzad, msc, typ: 'limona' }),
    [cenaLimona, dlugBank, dlugUrzad, msc]
  )
  const rC1 = useMemo(
    () => calcSciezka({ cenaSprzedazy: cenaLic1, dlugBank, dlugUrzad, msc, typ: 'lic' }),
    [cenaLic1, dlugBank, dlugUrzad, msc]
  )
  const rC2 = useMemo(
    () => calcSciezka({ cenaSprzedazy: cenaLic2, dlugBank, dlugUrzad, msc, typ: 'lic' }),
    [cenaLic2, dlugBank, dlugUrzad, msc]
  )

  const rC = licFrac === 0.75 ? rC1 : rC2
  const roznica = rL.wynik - rC.wynik

  const MONTHS = [12, 24, 36, 48, 60] as const
  const MONTHS_LABELS: Record<number, string> = { 12: '1 rok', 24: '2 lata', 36: '3 lata', 48: '4 lata', 60: '5 lat' }

  return (
    <div className="space-y-6">

      {/* Inputs */}
      <div className="limona-card p-4 space-y-4">
        <p className="text-xs font-bold text-limona-lime uppercase tracking-wider">Parametry nieruchomości i zadłużenia</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumInput
            label="Wartość rynkowa"
            value={wartoscRynkowa}
            onChange={v => { setWartoscRynkowa(v); setCenaLimona(Math.round(v * 0.8)) }}
            hint={`Podpowiedź Limona (80%): ${Math.round(wartoscRynkowa * 0.8).toLocaleString('pl-PL')} zł`}
          />
          <NumInput
            label="Cena sprzedaży przez Limonę"
            value={cenaLimona}
            onChange={setCenaLimona}
            hint="Edytowalna — zazwyczaj ok. 80% wartości rynkowej"
          />
          <NumInput
            label="Wartość z operatu szacunkowego"
            value={operatVal}
            onChange={setOperatVal}
            hint={`I lic.: ${Math.round(operatVal * 0.75).toLocaleString('pl-PL')} zł | II lic.: ${Math.round(operatVal * 0.6667).toLocaleString('pl-PL')} zł`}
          />
          <NumInput
            label="Dług bankowy / fundusz (18,5%)"
            value={dlugBank}
            onChange={setDlugBank}
            hint="Odsetki maksymalne za opóźnienie"
          />
          <NumInput
            label="Dług urzędowy — ZUS / US / KRUS (10,5%)"
            value={dlugUrzad}
            onChange={setDlugUrzad}
            hint="Odsetki urzędowe za zwłokę"
          />
        </div>

        <div className="border-t border-limona-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-limona-text-muted">Czas naliczania odsetek (od licytacji do planu podziału)</p>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map(m => (
                <button
                  key={m}
                  onClick={() => setMsc(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors',
                    msc === m
                      ? 'bg-limona-lime text-black border-limona-lime'
                      : 'border-limona-border text-limona-text-muted hover:border-limona-lime hover:text-limona-lime'
                  )}
                >
                  {MONTHS_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-limona-text-dim">Statystycznie 2–3 lata od licytacji do sporządzenia planu podziału</p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-limona-text-muted">Porównaj z licytacją</p>
            <div className="flex flex-wrap gap-2">
              {([0.75, 0.6667] as const).map(frac => (
                <button
                  key={frac}
                  onClick={() => setLicFrac(frac)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors',
                    licFrac === frac
                      ? 'bg-limona-lime text-black border-limona-lime'
                      : 'border-limona-border text-limona-text-muted hover:border-limona-lime hover:text-limona-lime'
                  )}
                >
                  {frac === 0.75 ? 'I licytacja — ¾ (75%)' : 'II licytacja — ⅔ (66,7%)'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-limona-text-dim">Zestawienie końcowe zawsze pokazuje obie ścieżki</p>
          </div>
        </div>
      </div>

      {/* Result cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Limona card */}
        <div className="limona-card border-2 border-limona-lime/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-limona-border">
            <span className="text-sm font-bold text-limona-white">Sprzedaż przez Limonę</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-limona-lime/15 text-limona-lime">
              Korzystna
            </span>
          </div>
          <table className="w-full">
            <tbody>
              <ResultRow label="Cena sprzedaży" value={fmt(rL.cena)} valueClass="text-limona-lime font-bold" />
              {rL.dlugTot > 0 && (
                <ResultRow
                  label="Spłata długu łącznie"
                  sub="dług bankowy + urzędowy, płatne przy akcie"
                  value={fmtNeg(rL.dlugTot)}
                  valueClass="text-limona-red"
                />
              )}
              <ResultRow label="Odsetki po akcie" sub="bieg zatrzymany w dniu zapłaty" value="– 0 zł" valueClass="text-limona-text-dim" />
              <ResultRow label="Koszty komornicze po akcie" sub="egzekucja umorzona po spłacie" value="– 0 zł" valueClass="text-limona-text-dim" />
              <ResultRow
                label="Prowizja Limona"
                sub={rL.cena < 1_000_000 ? '12 300 zł brutto (cena zakupu poniżej 1 mln)' : '24 600 zł brutto (cena zakupu powyżej 1 mln)'}
                value={fmtNeg(rL.prowizja)}
                valueClass="text-limona-red"
              />
              <ResultRow label="Koszty notarialne i PCC" sub="pokrywa kupujący" value="– 0 zł" valueClass="text-limona-text-dim" />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-limona-border">
                <td className="px-3 py-3 text-sm font-bold text-limona-text">Pozostaje dla dłużnika</td>
                <td className={cn('px-3 py-3 text-right font-mono font-bold text-base', rL.wynik >= 0 ? 'text-limona-lime' : 'text-limona-red')}>
                  {fmt(rL.wynik)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mx-3 mb-3 p-3 rounded bg-limona-lime/10 border border-limona-lime/20">
            <p className="text-xs text-limona-lime">Dłużnik nie ponosi żadnych kosztów transakcyjnych — notariusz, PCC i opłaty przy akcie leżą po stronie kupującego.</p>
          </div>
        </div>

        {/* Auction card */}
        <div className="limona-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-limona-border">
            <span className="text-sm font-bold text-limona-white">
              {licFrac === 0.75 ? 'I licytacja (¾ = 75%)' : 'II licytacja (⅔ ≈ 66,7%)'}
            </span>
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full',
              rC.wynik < 0 ? 'bg-limona-red/15 text-limona-red' : 'bg-limona-yellow/15 text-limona-yellow'
            )}>
              {rC.wynik < 0 ? 'Dramatyczna strata' : rC.wynik < rL.wynik * 0.5 ? 'Niekorzystna' : 'Porównywalna'}
            </span>
          </div>
          <table className="w-full">
            <tbody>
              <ResultRow label="Cena sprzedaży" value={fmt(rC.cena)} valueClass="text-limona-yellow font-bold" />
              {dlugBank > 0 && (
                <>
                  <ResultRow label="Fundusz / bank" value={fmtNeg(dlugBank)} valueClass="text-limona-red" />
                  <ResultRow
                    label="Odsetki od długu bankowego"
                    sub={`18,5% rocznie × ${msc} msc od licytacji do planu podziału`}
                    value={fmtNeg(rC.odsB)}
                    valueClass="text-limona-red"
                  />
                </>
              )}
              {dlugUrzad > 0 && (
                <>
                  <ResultRow label="Kapitał ZUS / US / KRUS" value={fmtNeg(dlugUrzad)} valueClass="text-limona-red" />
                  <ResultRow
                    label="Odsetki od długu urzędowego"
                    sub={`10,5% rocznie × ${msc} msc od licytacji do planu podziału`}
                    value={fmtNeg(rC.odsU)}
                    valueClass="text-limona-red"
                  />
                </>
              )}
              <ResultRow
                label="Opłata komornicza"
                sub="10% od narosłych odsetek"
                value={fmtNeg(rC.oplata)}
                valueClass="text-limona-red"
              />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-limona-border">
                <td className="px-3 py-3 text-sm font-bold text-limona-text">Pozostaje dla dłużnika</td>
                <td className={cn('px-3 py-3 text-right font-mono font-bold text-base', rC.wynik >= 0 ? 'text-limona-lime' : 'text-limona-red')}>
                  {fmt(rC.wynik)}
                </td>
              </tr>
            </tfoot>
          </table>
          {rC.wynik < 0 ? (
            <div className="mx-3 mb-3 p-3 rounded bg-limona-red/10 border border-limona-red/20">
              <p className="text-xs text-limona-red">
                Łączne potrącenia ({fmt(rC.potranienia)}) przekraczają cenę licytacyjną ({fmt(rC.cena)}). Dłużnik traci nieruchomość i nadal pozostaje dłużnikiem.
              </p>
            </div>
          ) : (
            <div className="mx-3 mb-3 p-3 rounded bg-limona-yellow/10 border border-limona-yellow/20">
              <p className="text-xs text-limona-yellow">
                Dłużnik odzyska {fmt(rC.wynik)} po pokryciu długu, odsetek i opłaty komorniczej.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary table */}
      <div className="limona-card overflow-hidden">
        <div className="px-4 py-3 border-b border-limona-border">
          <p className="text-sm font-bold text-limona-white">Zestawienie końcowe</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-limona-border">
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-limona-text-dim">Ścieżka</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-limona-text-dim">Cena sprzedaży</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-limona-text-dim">Łączne potrącenia</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-limona-text-dim">Nadwyżka dla dłużnika</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Limona', r: rL, active: true },
                { label: 'I licytacja (¾ = 75%)', r: rC1, active: licFrac === 0.75 },
                { label: 'II licytacja (⅔ ≈ 66,7%)', r: rC2, active: licFrac !== 0.75 },
              ].map(({ label, r, active }) => (
                <tr key={label} className={cn('border-b border-limona-border/40 last:border-0', !active && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium text-limona-text">{label}</td>
                  <td className="px-4 py-3 text-right font-mono text-limona-text">{fmt(r.cena)}</td>
                  <td className="px-4 py-3 text-right font-mono text-limona-text">{fmt(r.potranienia)}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-bold', r.wynik >= 0 ? 'text-limona-lime' : 'text-limona-red')}>
                    {fmt(r.wynik)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={cn(
          'px-4 py-3 text-sm border-t border-limona-border',
          roznica > 0 ? 'bg-limona-lime/10 text-limona-lime' :
          roznica < 0 ? 'bg-limona-yellow/10 text-limona-yellow' : 'text-limona-text-muted'
        )}>
          {roznica > 0
            ? <>Dłużnik zyskuje na sprzedaży przez Limonę o <strong>{fmt(roznica)}</strong> więcej niż na wybranej licytacji.</>
            : roznica < 0
              ? <>Licytacja daje dłużnikowi o <strong>{fmt(Math.abs(roznica))}</strong> więcej niż Limona.</>
              : 'Obie ścieżki dają dłużnikowi tę samą kwotę.'
          }
        </div>
      </div>

      {/* Assumptions */}
      <div className="limona-card p-4 text-xs text-limona-text-muted space-y-2 leading-relaxed">
        <p className="text-[10px] font-bold uppercase tracking-wider text-limona-text-dim mb-3">Podstawa kalkulacji</p>
        <p><strong className="text-limona-text">Odsetki bankowe / fundusze / prywatne (18,5%)</strong> — odsetki maksymalne za opóźnienie (art. 481 § 2¹ KC): 2 × (stopa ref. NBP 3,75% + 5,5 pp). Naliczane od licytacji do dnia sporządzenia planu podziału.</p>
        <p><strong className="text-limona-text">Odsetki urzędowe — ZUS, US, KRUS (10,5%)</strong> — standardowa stawka odsetek za zwłokę od należności publicznych.</p>
        <p><strong className="text-limona-text">Opłata komornicza</strong> — 10% wyegzekwowanego świadczenia (art. 28 ustawy o kosztach komorniczych). Opłata od odsetek liczona osobno.</p>
        <p><strong className="text-limona-text">Prowizja Limona</strong> — 12 300 zł brutto przy cenie zakupu do 1 000 000 zł; 24 600 zł brutto powyżej 1 000 000 zł.</p>
        <p><strong className="text-limona-text">Koszty notarialne i PCC</strong> — pokrywa kupujący. Dłużnik nie ponosi żadnych kosztów transakcyjnych.</p>
        <div className="mt-3 p-3 rounded border border-limona-border/60 bg-limona-surface-2 text-[10px] text-limona-text-dim">
          Kalkulator ma charakter poglądowy. Rzeczywiste kwoty zależą od indywidualnej sytuacji prawnej, zapisów tytułu wykonawczego, liczby wierzycieli i przebiegu postępowania. Nie stanowi porady prawnej ani finansowej.
        </div>
      </div>
    </div>
  )
}
