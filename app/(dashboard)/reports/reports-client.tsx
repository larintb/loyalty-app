'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Users, Receipt, Star, AlertTriangle, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesChart } from '@/components/reports/sales-chart'
import type { DailySale, TopCustomer, ChurnCustomer, PeriodMetrics } from '@/actions/reports'

type Props = {
  dailySales7: DailySale[]
  dailySales30: DailySale[]
  topCustomers: TopCustomer[]
  churnCustomers: ChurnCustomer[]
  metrics7: PeriodMetrics
  metrics30: PeriodMetrics
}

type Period = 7 | 30

export function ReportsClient({
  dailySales7,
  dailySales30,
  topCustomers,
  churnCustomers,
  metrics7,
  metrics30,
}: Props) {
  const [period, setPeriod] = useState<Period>(30)

  const sales = period === 7 ? dailySales7 : dailySales30
  const metrics = period === 7 ? metrics7 : metrics30

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex gap-1.5 bg-muted p-1 rounded-lg w-fit">
        {([7, 30] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === p
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p === 7 ? 'Últimos 7 días' : 'Últimos 30 días'}
          </button>
        ))}
      </div>

      {/* Métricas del período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          label="Ventas totales"
          value={`$${metrics.totalSales.toFixed(0)}`}
          sub={`${metrics.totalTransactions} ticket${metrics.totalTransactions !== 1 ? 's' : ''}`}
        />
        <MetricCard
          icon={<Receipt className="h-4 w-4 text-blue-500" />}
          label="Ticket promedio"
          value={`$${metrics.avgTicket}`}
          sub="por transacción"
        />
        <MetricCard
          icon={<Users className="h-4 w-4 text-purple-500" />}
          label="Clientes nuevos"
          value={String(metrics.newCustomers)}
          sub="registrados"
        />
        <MetricCard
          icon={<Star className="h-4 w-4 text-amber-500" />}
          label="Ventas con cliente"
          value={`${metrics.returningRate}%`}
          sub="identificados"
        />
      </div>

      {/* Gráfica de ventas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendencia de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={sales} days={period} />
        </CardContent>
      </Card>

      {/* Grid: Top clientes + Churn */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top clientes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Clientes con mayor gasto</CardTitle>
              <Link
                href="/customers"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sin clientes aún.
              </p>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((c, i) => (
                  <Link key={c.id} href={`/customers/${c.id}`} className="block">
                    <div className="flex items-center gap-3 hover:bg-muted/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      {/* Ranking + avatar */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs text-muted-foreground w-4 text-center">
                          {i + 1}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.visit_count} visita{c.visit_count !== 1 ? 's' : ''} · ticket ${c.avg_ticket}
                        </p>
                      </div>
                      {/* Gasto */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">${c.lifetime_spend.toFixed(0)}</p>
                        {c.total_points > 0 && (
                          <p className="text-xs text-amber-600 flex items-center gap-0.5 justify-end">
                            <Star className="h-2.5 w-2.5" />
                            {c.total_points}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Churn risk */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Clientes inactivos</CardTitle>
              {churnCustomers.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {churnCustomers.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {churnCustomers.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-2xl">✅</p>
                <p className="text-sm text-muted-foreground">
                  Todos tus clientes han visitado recientemente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {churnCustomers.map((c) => (
                  <Link key={c.id} href={`/customers/${c.id}`} className="block">
                    <div className="flex items-center gap-3 hover:bg-muted/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      {/* Icono de riesgo */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          c.risk === 'high'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}
                      >
                        <AlertTriangle
                          className={`h-4 w-4 ${
                            c.risk === 'high'
                              ? 'text-red-500'
                              : 'text-amber-500'
                          }`}
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Hace {c.days_inactive} días sin visitar
                        </div>
                      </div>
                      {/* Badge */}
                      <Badge
                        variant={c.risk === 'high' ? 'destructive' : 'outline'}
                        className="text-xs shrink-0"
                      >
                        {c.risk === 'high' ? 'Alto riesgo' : 'Moderado'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}
