import { getDashboardMetrics } from '@/actions/finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp, DollarSign, BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error cargando métricas.
      </div>
    )
  }

  const now = new Date()
  const monthName = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm capitalize">{monthName}</p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Clientes</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{metrics.totalCustomers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">registrados activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Ventas hoy</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">${metrics.salesToday.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">del día</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Ventas del mes</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">${metrics.salesMonth.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">en ventas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Utilidad del mes</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p
              className={`text-2xl font-bold ${
                metrics.profitMonth >= 0 ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {metrics.profitMonth >= 0 ? '+' : ''}${metrics.profitMonth.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">ingresos − egresos</p>
          </CardContent>
        </Card>
      </div>

      {/* Últimas ventas */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas ventas</CardTitle>
          <Link
            href="/finance"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Ver finanzas <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {metrics.recentTransactions.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground text-sm">Sin ventas aún.</p>
              <Link
                href="/pos"
                className="text-sm font-medium text-primary hover:underline"
              >
                Registra tu primera venta en el POS →
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {metrics.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {tx.ticket_number ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('es-MX', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="font-semibold">${tx.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/pos', label: 'Ir al POS', emoji: '🏪' },
          { href: '/customers', label: 'Clientes', emoji: '👥' },
          { href: '/finance', label: 'Finanzas', emoji: '💰' },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl mb-1">{item.emoji}</div>
                <p className="text-sm font-medium">{item.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
