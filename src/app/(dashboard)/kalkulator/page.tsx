'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator1 } from '@/components/calculator/Calculator1'
import { Calculator2 } from '@/components/calculator/Calculator2'
import { useProperties } from '@/hooks/useProperties'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import type { Calc1Input, Calc2Input } from '@/lib/calculator'
import type { Property } from '@/types/database'

const DEFAULT_CALC1: Calc1Input = {
  valuePerSqm: 0,
  totalDebt: 0,
  additionalCosts: 0,
}

const DEFAULT_CALC2: Calc2Input = {
  valuePerSqm: 0,
  totalDebt: 0,
  creditor1: 0,
  creditor2: 0,
  creditor3: 0,
  ownerCoefficient: 0.025,
  additionalCosts: 0,
}

export default function KalkulatorPage() {
  const [mode, setMode] = useState<'below' | 'above'>('below')
  const [calc1Input, setCalc1Input] = useState<Calc1Input>({ ...DEFAULT_CALC1 })
  const [calc2Input, setCalc2Input] = useState<Calc2Input>({ ...DEFAULT_CALC2 })
  const [saving, setSaving] = useState(false)

  const { createProperty } = useProperties()
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  function setCalc1(key: keyof Calc1Input, value: number | null) {
    setCalc1Input(prev => ({ ...prev, [key]: value ?? 0 }))
  }

  function setCalc2(key: keyof Calc2Input, value: number | null) {
    setCalc2Input(prev => ({ ...prev, [key]: value ?? 0 }))
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)

    const data: Partial<Property> = mode === 'below'
      ? {
          adres: 'Nowa nieruchomość (z kalkulatora)',
          value_per_sqm: calc1Input.valuePerSqm,
          total_debt: calc1Input.totalDebt,
          debt_type: 'below_value',
          deal_type: 'zadluzony_ponizej',
        }
      : {
          adres: 'Nowa nieruchomość (z kalkulatora)',
          value_per_sqm: calc2Input.valuePerSqm,
          total_debt: calc2Input.totalDebt,
          debt_type: 'above_value',
          deal_type: 'zadluzony_powyzej',
          creditor1_amount: calc2Input.creditor1,
          creditor2_amount: calc2Input.creditor2,
          creditor3_amount: calc2Input.creditor3,
          owner_coefficient: calc2Input.ownerCoefficient,
        }

    const { data: newProp, error } = await createProperty(data, user.id)
    setSaving(false)

    if (error) {
      showToast(error, 'error')
    } else if (newProp) {
      showToast('Nieruchomość zapisana w CRM', 'success')
      router.push(`/nieruchomosci/${newProp.id}`)
    }
  }

  function handleReset() {
    if (mode === 'below') setCalc1Input({ ...DEFAULT_CALC1 })
    else setCalc2Input({ ...DEFAULT_CALC2 })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Narzędzia</span>
        <h1 className="limona-heading text-3xl mt-1">Kalkulator</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Szybkie przeliczenie opłacalności nieruchomości
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-limona-surface rounded w-fit">
        <button
          onClick={() => setMode('below')}
          className={`px-5 py-2 rounded text-sm font-bold uppercase tracking-wider transition-all ${
            mode === 'below'
              ? 'bg-limona-lime text-black'
              : 'text-limona-text-muted hover:text-limona-white'
          }`}
        >
          Poniżej wartości
        </button>
        <button
          onClick={() => setMode('above')}
          className={`px-5 py-2 rounded text-sm font-bold uppercase tracking-wider transition-all ${
            mode === 'above'
              ? 'bg-limona-lime text-black'
              : 'text-limona-text-muted hover:text-limona-white'
          }`}
        >
          Powyżej wartości
        </button>
      </div>

      {/* Calculator */}
      <div className="limona-card p-6">
        {mode === 'below' ? (
          <Calculator1 input={calc1Input} onChange={setCalc1} showInputs />
        ) : (
          <Calculator2 input={calc2Input} onChange={setCalc2} showInputs />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleReset} className="limona-btn-outline">
          Wyczyść
        </button>
        <button onClick={handleSave} disabled={saving} className="limona-btn disabled:opacity-50">
          {saving ? 'Zapisywanie...' : 'Zapisz jako nieruchomość w CRM'}
        </button>
      </div>
    </div>
  )
}
