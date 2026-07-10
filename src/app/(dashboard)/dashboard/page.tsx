'use client'

export const dynamic = 'force-dynamic'

import { useMemo } from 'react'
import Link from 'next/link'
import { Building2, ListTodo, Clock, CheckCircle, AlertCircle, Plus, Inbox, ArrowRight, MessageSquare, Bell } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { useTasks } from '@/hooks/useTasks'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/hooks/useAuth'
import { useVisibleUserIds } from '@/hooks/useTeamVisibility'
import { useWall } from '@/hooks/useWall'
import { useNotifications } from '@/hooks/useNotifications'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { calculateBelow, calculateAbove, sumCosts } from '@/lib/calculator'
import { formatMoney, formatPercent, formatPropertyAddress, cn } from '@/lib/utils'
import { STATUS_DLUZNIKA_OPTIONS, STATUS_DLUZNIKA_LABELS } from '@/lib/stages'
import type { Property, StatusDluznika } from '@/types/database'

function calcProfit(p: Property): number | null {
  if (!p.value_per_sqm) return null
  try {
    const additionalCosts = sumCosts(p.koszty_dodatkowe)
    if (p.debt_type === 'above_value') {
      return calculateAbove({
        valuePerSqm: p.value_per_sqm, totalDebt: p.total_debt || 0,
        creditor1: p.creditor1_amount || 0, creditor2: p.creditor2_amount || 0, creditor3: p.creditor3_amount || 0,
        ownerCoefficient: p.owner_coefficient || 0.025, additionalCosts,
      }).profit
    } else {
      return calculateBelow({
        valuePerSqm: p.value_per_sqm, totalDebt: p.total_debt || 0, additionalCosts,
      }).profit
    }
  } catch { return null }
}

const statusPipeline: StatusDluznika[] = STATUS_DLUZNIKA_OPTIONS

const statusLabels: Record<string, string> = STATUS_DLUZNIKA_LABELS

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { visibleIds } = useVisibleUserIds(profile?.id, profile?.role)
  const { properties, loading: propsLoading } = useProperties(visibleIds)
  const { tasks, loading: tasksLoading } = useTasks(undefined, visibleIds)
  const { leads, loading: leadsLoading } = useLeads()
  const { messages: wallMessages, loading: wallLoading, isRead } = useWall(user?.id)
  const { unreadCount: notifUnread } = useNotifications(user?.id)

  const wallUnread = wallMessages.filter(m => !isRead(m.id) && m.user_id !== user?.id).length
  const recentWall = wallMessages.slice(0, 6)

  const stats = useMemo(() => {
    const active = properties.filter(p => p.status_dluznika !== 'sprzedaz')
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
          const additionalCosts = sumCosts(p.koszty_dodatkowe)
          if (p.debt_type === 'above_value') {
            const r = calculateAbove({
              valuePerSqm: p.value_per_sqm!, totalDebt: p.total_debt || 0,
              creditor1: p.creditor1_amount || 0, creditor2: p.creditor2_amount || 0, creditor3: p.creditor3_amount || 0,
              ownerCoefficient: p.owner_coefficient || 0.025, additionalCosts,
            })
            return sum + r.roi
          } else {
            const r = calculateBelow({
              valuePerSqm: p.value_per_sqm!, totalDebt: p.total_debt || 0, additionalCosts,
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

  const todayStr = new Date().toISOString().split('T')[0]

  const todayTasks = useMemo(() =>
    tasks
      .filter(t => t.due_date && t.due_date.substring(0, 10) === todayStr && t.status !== 'done')
      .slice(0, 5),
    [tasks, todayStr]
  )

  const myOverdueTasks = useMemo(() =>
    tasks
      .filter(t => t.due_date && t.due_date.substring(0, 10) < todayStr && t.status !== 'done')
      .slice(0, 5),
    [tasks, todayStr]
  )

  const leadStats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
  }

  const belowValue = properties.filter(p => p.deal_type === 'zadluzony_ponizej').slice(0, 4)
  const aboveValue = properties.filter(p => p.deal_type === 'zadluzony_powyzej').slice(0, 4)
  const recentLeads = leads.slice(0, 5)

  const pipelineStats = statusPipeline.map(s => ({
    status: s,
    count: properties.filter(p => p.status_dluznika === s).length,
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            <p className="font-mono font-bold text-2xl text-limona-white">
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
          <div className="limona-card p-4 border-l-[3px] border-l-limona-lime">
            <p className="limona-eyebrow text-xs mb-2">Leady</p>
            <p className="font-heading font-bold text-4xl text-limona-lime">
              {leadsLoading ? '…' : leadStats.total}
            </p>
            <p className="text-xs text-limona-text-muted mt-1">{leadStats.new} nowych</p>
          </div>
        </div>
      )}

      {/* Communication bar */}
      {(wallUnread > 0 || notifUnread > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {wallUnread > 0 && (
            <Link href="/komunikacja" className="limona-card-hover p-4 flex items-center gap-4 border-l-[3px] border-l-limona-lime">
              <div className="w-10 h-10 rounded bg-limona-lime/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={20} className="text-limona-lime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">Wall — Komunikacja</p>
                <p className="font-heading font-bold text-2xl text-limona-lime leading-tight">{wallUnread}</p>
                <p className="text-xs text-limona-text-dim">nieprzeczytanych wiadomości</p>
              </div>
              <ArrowRight size={16} className="text-limona-text-dim flex-shrink-0" />
            </Link>
          )}
          {notifUnread > 0 && (
            <div className="limona-card p-4 flex items-center gap-4 border-l-[3px] border-l-limona-red">
              <div className="w-10 h-10 rounded bg-limona-red/10 flex items-center justify-center flex-shrink-0">
                <Bell size={20} className="text-limona-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-limona-text-muted font-bold">Powiadomienia</p>
                <p className="font-heading font-bold text-2xl text-limona-red leading-tight">{notifUnread}</p>
                <p className="text-xs text-limona-text-dim">nieodczytanych powiadomień</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline */}
      <div className="limona-card p-4 lg:p-6">
        <h2 className="limona-heading text-lg mb-4">Pipeline statusów</h2>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {pipelineStats.map(({ status, count }) => (
            <Link key={status} href={`/nieruchomosci?status_dluznika=${status}`}
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

      {/* Property split + tasks/communication grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Zadłużone poniżej wartości */}
        <div className="limona-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="limona-heading text-lg">Poniżej wartości</h2>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">zadłużone poniżej wartości</p>
            </div>
            <Link href="/nieruchomosci" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Wszystkie
            </Link>
          </div>
          {propsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : belowValue.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-limona-text-muted mb-4">Brak nieruchomości</p>
              <Link href="/nieruchomosci" className="limona-btn-sm inline-flex items-center gap-2">
                <Plus size={12} /> Dodaj pierwszą
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {belowValue.map(p => {
                const profit = calcProfit(p)
                const isOK = profit != null && profit >= 120000
                return (
                  <Link key={p.id} href={`/nieruchomosci/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded hover:bg-limona-surface-2 transition-colors group">
                    <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', isOK ? 'bg-limona-green' : 'bg-limona-border')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-limona-white truncate group-hover:text-limona-lime transition-colors">
                        {formatPropertyAddress(p)}
                      </p>
                      <p className="text-xs text-limona-text-dim">{statusLabels[p.status_dluznika] || p.status_dluznika}</p>
                    </div>
                    <p className={cn('text-xs font-mono font-bold flex-shrink-0', isOK ? 'text-limona-green' : 'text-limona-text-muted')}>
                      {formatMoney(profit)}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Zadłużone powyżej wartości */}
        <div className="limona-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="limona-heading text-lg">Powyżej wartości</h2>
              <p className="text-[10px] text-limona-text-dim uppercase tracking-wider">zadłużone powyżej wartości</p>
            </div>
            <Link href="/nieruchomosci" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Wszystkie
            </Link>
          </div>
          {propsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : aboveValue.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-limona-text-muted">Brak nieruchomości</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aboveValue.map(p => {
                const profit = calcProfit(p)
                const isOK = profit != null && profit >= 0
                return (
                  <Link key={p.id} href={`/nieruchomosci/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded hover:bg-limona-surface-2 transition-colors group">
                    <div className="w-1.5 h-8 rounded-full bg-limona-lime/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-limona-white truncate group-hover:text-limona-lime transition-colors">
                        {formatPropertyAddress(p)}
                      </p>
                      <p className="text-xs text-limona-text-dim">{statusLabels[p.status_dluznika] || p.status_dluznika}</p>
                    </div>
                    <p className={cn('text-xs font-mono font-bold flex-shrink-0', isOK ? 'text-limona-lime' : 'text-limona-text-muted')}>
                      {formatMoney(profit)}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Tasks — today + overdue */}
        <div className="limona-card p-4 lg:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="limona-heading text-lg">Zadania</h2>
            <Link href="/zadania" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Wszystkie
            </Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (todayTasks.length === 0 && myOverdueTasks.length === 0) ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="text-limona-green mx-auto mb-3" />
              <p className="text-limona-text-muted text-sm">Brak zadań na dziś</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-limona-lime font-bold mb-2">Na dziś</p>
                  <div className="space-y-2">
                    {todayTasks.map(task => (
                      <Link key={task.id} href="/zadania"
                        className="flex items-center gap-3 p-2 rounded bg-limona-lime/5 border border-limona-lime/20 hover:border-limona-lime/40 transition-colors">
                        <Clock size={16} className="text-limona-lime flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-limona-white truncate">{task.title}</p>
                          {task.property && <p className="text-xs text-limona-text-dim truncate">{formatPropertyAddress(task.property)}</p>}
                        </div>
                        <Badge value={task.priority} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {myOverdueTasks.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-limona-red font-bold mb-2">Przeterminowane</p>
                  <div className="space-y-2">
                    {myOverdueTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-limona-red/5 border border-limona-red/20">
                        <AlertCircle size={16} className="text-limona-red flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-limona-white truncate">{task.title}</p>
                          {task.due_date && <p className="text-xs text-limona-red">{new Date(task.due_date).toLocaleDateString('pl-PL')}</p>}
                        </div>
                        <Badge value={task.priority} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wall messages */}
        <div className="limona-card p-4 lg:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="limona-heading text-lg">Komunikacja</h2>
              {wallUnread > 0 && (
                <span className="bg-limona-lime text-black text-[10px] font-bold rounded-full px-2 py-0.5 leading-none">
                  {wallUnread} nowych
                </span>
              )}
            </div>
            <Link href="/komunikacja" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Otwórz
            </Link>
          </div>
          {wallLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : recentWall.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={32} className="text-limona-text-dim mx-auto mb-3" />
              <p className="text-limona-text-muted text-sm">Brak wiadomości</p>
              <Link href="/komunikacja" className="mt-3 limona-btn-sm inline-flex items-center gap-2">
                <Plus size={12} /> Napisz pierwszą
              </Link>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {recentWall.map(msg => {
                const unread = !isRead(msg.id) && msg.user_id !== user?.id
                return (
                  <Link key={msg.id} href="/komunikacja"
                    className={cn(
                      'flex items-start gap-3 p-2.5 rounded transition-colors hover:bg-limona-surface-2',
                      unread && 'border-l-[3px] border-l-limona-lime bg-limona-lime/5'
                    )}>
                    <Avatar name={msg.user?.full_name || '?'} url={msg.user?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-limona-white truncate">{msg.user?.full_name || 'Użytkownik'}</span>
                        {unread && <span className="w-1.5 h-1.5 bg-limona-lime rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-limona-text-muted truncate mt-0.5">{msg.content}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Leads panel */}
        <div className="limona-card p-4 lg:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="limona-heading text-lg">Leady</h2>
            <Link href="/leady" className="text-xs text-limona-lime hover:text-limona-lime-hover transition-colors uppercase tracking-wider">
              Wszystkie
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Nowe',     value: leadStats.new,       color: 'bg-limona-text-dim' },
              { label: 'Kontakt',  value: leadStats.contacted,  color: 'bg-limona-blue' },
              { label: 'Kwalif.',  value: leadStats.qualified,  color: 'bg-limona-yellow' },
              { label: 'Konwert.', value: leadStats.converted,  color: 'bg-limona-green' },
            ].map(s => (
              <div key={s.label} className="limona-card p-2 text-center">
                <div className={cn('w-2 h-2 rounded-full mx-auto mb-1', s.color)} />
                <p className="font-mono font-bold text-lg text-limona-white">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-limona-text-dim">{s.label}</p>
              </div>
            ))}
          </div>
          {leadsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : recentLeads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <Inbox size={28} className="text-limona-text-dim mb-2" />
              <p className="text-limona-text-muted text-sm">Brak leadów</p>
              <Link href="/leady" className="mt-3 limona-btn-sm inline-flex items-center gap-2">
                <Plus size={12} /> Dodaj
              </Link>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {recentLeads.map(l => (
                <Link key={l.id} href="/leady"
                  className="flex items-center gap-2 p-2 rounded hover:bg-limona-surface-2 transition-colors group">
                  <div className={cn('w-1.5 h-6 rounded-full flex-shrink-0',
                    l.status === 'new' ? 'bg-limona-text-dim' :
                    l.status === 'contacted' ? 'bg-limona-blue' :
                    l.status === 'qualified' ? 'bg-limona-yellow' :
                    l.status === 'converted' ? 'bg-limona-green' : 'bg-limona-red'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-limona-white truncate group-hover:text-limona-lime transition-colors">{l.name}</p>
                    <p className="text-xs text-limona-text-dim truncate">{l.source || l.location || '—'}</p>
                  </div>
                  <ArrowRight size={12} className="text-limona-text-dim group-hover:text-limona-lime flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
