'use client'

export const dynamic = 'force-dynamic'

import { useMemo } from 'react'
import Link from 'next/link'
import { Building2, Calculator, ListTodo, TrendingUp, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { calculateBelow, calculateAbove } from '@/lib/calculator'
import { formatMoney, formatPercent, cn } from '@/lib/utils'
import type { Property, PropertyStatus } from '@/types/database'

function calcProfit(p: Property): number | null {
  if (!p.value_per_sqm) return null
  try {
    if (p.debt_type === 'above_value') {
      return calculateAbove({
        valuePerSqm: p.value_per_sqm, totalDebt: p.total_debt || 0,
        creditor1: p.creditor1_amount || 0, creditor2: p.creditor2_amount || 0, creditor3: p.creditor3_amount || 0,
        ownerCoefficient: p.owner_coefficient || 0.025, commissionPct: (p.commission_pct || 0) / 100,
        notaryFee: p.notary_fee || 1000,
      }).profit
    } else {
      return calculateBelow({
        valuePerSqm: p.value_per_sqm, totalDebt: p.total_debt || 0,
        commissionPct: (p.commission_pct || 0) / 100, notaryFee: p.notary_fee || 1000,
      }).profit
    }
  } catch { return null }
}

const statusPipeline: PropertyStatus[] = ['new', 'analysis', 'offer_sent', 'negotiation', 'contract', 'legal_cleanup', 'sale', 'completed']

const statusLabels: Record<string, string> = {
  new: 'Nowa', analysis: 'Analiza', offer_sent: 'Oferta', negotiation: 'Negocjacja',
  contract: 'Umowa', legal_cleanup: 'Regulacja', sale: 'Sprzedaż', completed: 'Zakończona', rejected: 'Odrzucona',
}

export default function DashboardPage() {
  const { properties, loading: propsLoading } = useProperties()
  const { tasks, loading: tasksLoading } = useTasks()
  const { profile } = useAuth()

  const stats = useMemo(() => {
    const active = properties.filter(p => p.status !== 'rejected')
    const okProps = properties.filter(p => {
      const profit = calcProfit(p)
      return profit != null && profit >= 120000
    })
    const totalPotentialProfit = okProps.reduce((sum, p) => sum + (calcProfit(p) || 0), 0)
    const avgRoi = (() => {
      const withRoi = properties.filter(p => p.value_per_sqm)
      if (withRoi.length === 0) return 0
      // Simple average: calc each and mean
      return withRoi.reduce((sum, p) => {
        try {
          if (p.debt_type === 'above_value') {
            const r = calculateAbove({
              valuePerSqm: p.value_per_sqm!, totalDebt: p.total_debt || 0,
              creditor1: p.creditor1_amount || 0, creditor2: p.creditor2_amount || 0, creditor3: p.creditor3_amount || 0,
              ownerCoefficient: p.owner_coefficient || 0.025, commissionPct: (p.commission_pct || 0) / 100,
              notaryFee: p.notary_fee || 1000,
            })
            return sum + r.roi
          } else {
            const r = calculateBelow({
              valuePerSqm: p.value_per_sqm!, totalDebt: p.total_debt || 0,
              commissionPct: (p.commission_pct || 0) / 100, notaryFee: p.notary_fee || 1000,
            })
            return sum + r.roi
          }
        } catch { return sum }
      }, 0) / withRoi.length
    })()

    return {
      total: properties.length,
      active: active.length,
      ok: okProps.length,
      totalPotentialProfit,
      avgRoi,
    }
  }, [properties])

  const myOverdueTasks = useMemo(() =>
    tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
      .slice(0, 5),
    [tasks]
  )

  const recentProps = properties.slice(0, 5)

  const pipelineStats = statusPipeline.map(s => ({
    status: s,
    count: properties.filter(p => p.status === s).length,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Overview</span>
        <h1 className="limona-heading text-3xl mt-1">
          Witaj, {profile?.full_name?.split(' ')[0] || 'Użytkownik'}
        </h1>
        <p className="text-limona-text-muted text-sm mt-1">
          {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      {propsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="limona-card-accent p-4">
            <p className="limona-eyebrow text-xs mb-2">Nieruchomości</p>
            <p className="font-heading font-bold text-4xl text-limona-white">{stats.total}</p>
            <p className="text-xs text-limona-text-muted mt-1">{stats.active} aktywnych</p>
          </div>
          <div className="limona-card p-4 border-l-[3px] border-l-limona-green">
            <p className="limona-eyebrow text-xs mb-2">Opłacalne</p>
            <p className="font-heading font-bold text-4xl text-limona-green">{stats.ok}</p>
            <p className="text-xs text-limona-text-muted mt-1">decyzja OK</p>
          </div>
          <div className="limona-card p-4 border-l-[3px] border-l-limona-blue">
            <p className="limona-eyebrow text-xs mb-2">Pot. zysk</p>
            <p className="font-heading font-bold text-2xl text-limona-white font-mono">
              {formatMoney(stats.totalPotentialProfit)}
            </p>
            <p className="text-xs text-limona-text-muted mt-1">suma OK nieruchomości</p>
          </div>
          <div className="limona-card p-4 border-l-[3px] border-l-limona-yellow">
            <p className="limona-eyebrow text-xs mb-2">Śr. ROI</p>
            <p className="font-heading font-bold text-4xl text-limona-white">
              {formatPercent(stats.avgRoi)}
            </p>
            <p className="text-xs text-limona-text-muted mt-1">wszystkie nieruchomości</p>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="limona-card p-4 lg:p-6">
        <h2 className="limona-heading text-lg mb-4">Pipeline statusów</h2>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {pipelineStats.map(({ status, count }) => (
            <Link key={status} href={`/nieruchomosci?status=${status}`}
              className="text-center group">
              <div className={cn(
                'limona-card p-3 mb-2 group-hover:border-limona-lime transition-colors',
                count > 0 ? '' : 'opacity-40'
              )}>
                <p className="font-mono font-bold text-2xl text-limona-white">{count}</p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-limona-text-muted">{statusLabels[status]}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Two columns: recent + tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent properties */}
        <div className="limona-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="limona-heading text-lg">Ostatnie nieruchomości</h2>
            <Link href="/nieruchomosci" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Zobacz wszystkie
            </Link>
          </div>
          {propsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : recentProps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-limona-text-muted mb-4">Brak nieruchomości</p>
              <Link href="/nieruchomosci" className="limona-btn-sm inline-flex items-center gap-2">
                <Plus size={12} />
                Dodaj pierwszą
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProps.map(p => {
                const profit = calcProfit(p)
                const isOK = profit != null && profit >= 120000
                return (
                  <Link key={p.id} href={`/nieruchomosci/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded hover:bg-limona-surface-2 transition-colors group">
                    <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', isOK ? 'bg-limona-green' : 'bg-limona-border')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-limona-white truncate group-hover:text-limona-lime transition-colors">
                        {p.location}
                      </p>
                      <p className="text-xs text-limona-text-dim">{statusLabels[p.status]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-xs font-mono font-bold', isOK ? 'text-limona-green' : 'text-limona-text-muted')}>
                        {formatMoney(profit)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Overdue tasks */}
        <div className="limona-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="limona-heading text-lg">Zadania do wykonania</h2>
            <Link href="/zadania" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Wszystkie
            </Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : myOverdueTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="text-limona-green mx-auto mb-3" />
              <p className="text-limona-text-muted text-sm">Brak przeterminowanych zadań</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myOverdueTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-limona-red/5 border border-limona-red/20">
                  <AlertCircle size={16} className="text-limona-red flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-limona-white truncate">{task.title}</p>
                    {task.due_date && (
                      <p className="text-xs text-limona-red">
                        Termin: {new Date(task.due_date).toLocaleDateString('pl-PL')}
                      </p>
                    )}
                  </div>
                  <Badge value={task.priority} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="limona-heading text-lg mb-4">Szybkie akcje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/nieruchomosci', icon: Building2, label: 'Nieruchomości', desc: 'Zarządzaj pipeline' },
            { href: '/kalkulator', icon: Calculator, label: 'Kalkulator', desc: 'Szybka analiza' },
            { href: '/zadania', icon: ListTodo, label: 'Zadania', desc: 'Kanban board' },
          ].map(action => (
            <Link key={action.href} href={action.href}
              className="limona-card-hover p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-limona-lime/10 flex items-center justify-center flex-shrink-0">
                <action.icon size={20} className="text-limona-lime" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm uppercase tracking-wide text-limona-white">{action.label}</p>
                <p className="text-xs text-limona-text-muted">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
