'use client'

import { TrendingUp, TrendingDown, DollarSign, Percent, CheckCircle, XCircle } from 'lucide-react'
import { formatMoney, formatPercent, cn } from '@/lib/utils'

interface CalcResultCardProps {
  label: string
  value: string
  sublabel?: string
  variant?: 'default' | 'profit' | 'loss' | 'decision-ok' | 'decision-nie' | 'neutral'
  icon?: React.ReactNode
  large?: boolean
}

export function CalcResultCard({ label, value, sublabel, variant = 'default', icon, large }: CalcResultCardProps) {
  const styles = {
    default: 'border-limona-border',
    profit: 'border-limona-green/40',
    loss: 'border-limona-red/40',
    'decision-ok': 'border-limona-green bg-limona-green/10',
    'decision-nie': 'border-limona-red bg-limona-red/10',
    neutral: 'border-limona-border',
  }
  const textStyles = {
    default: 'text-limona-white',
    profit: 'text-limona-green',
    loss: 'text-limona-red',
    'decision-ok': 'text-limona-green',
    'decision-nie': 'text-limona-red',
    neutral: 'text-limona-text-muted',
  }

  return (
    <div className={cn('limona-card p-4', styles[variant])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-limona-text-muted mb-1">{label}</p>
          <p className={cn('font-mono font-bold', large ? 'text-2xl' : 'text-lg', textStyles[variant])}>
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-limona-text-dim mt-1">{sublabel}</p>
          )}
        </div>
        {icon && (
          <div className={cn('flex-shrink-0 mt-1', textStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

interface SummaryDecisionProps {
  profit: number
  roi: number
  decision: 'OK' | 'NIE'
  label?: string
}

export function SummaryDecision({ profit, roi, decision, label = 'Wynik kalkulacji' }: SummaryDecisionProps) {
  const isOK = decision === 'OK'

  return (
    <div className={cn(
      'limona-card p-6 border-l-[4px]',
      isOK ? 'border-l-limona-green' : 'border-l-limona-red'
    )}>
      <div className="flex items-center gap-3 mb-4">
        {isOK
          ? <CheckCircle size={24} className="text-limona-green" />
          : <XCircle size={24} className="text-limona-red" />
        }
        <div>
          <p className="text-xs uppercase tracking-wider text-limona-text-muted">{label}</p>
          <p className={cn('font-heading font-bold text-2xl uppercase', isOK ? 'text-limona-green' : 'text-limona-red')}>
            {decision}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-limona-text-muted mb-1">Zysk</p>
          <p className={cn('font-mono font-bold text-xl', isOK ? 'text-limona-green' : 'text-limona-red')}>
            {formatMoney(profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-limona-text-muted mb-1">ROI</p>
          <p className={cn('font-mono font-bold text-xl', roi >= 0.36 ? 'text-limona-green' : 'text-limona-red')}>
            {formatPercent(roi)}
          </p>
        </div>
      </div>

      {!isOK && (
        <p className="text-xs text-limona-text-dim mt-3">
          Min. zysk: 120 000 zł lub ROI ≥ 36%
        </p>
      )}
    </div>
  )
}
