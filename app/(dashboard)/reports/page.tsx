import { getDailySales, getTopCustomers, getChurnRisk, getPeriodMetrics } from '@/actions/reports'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const [dailySales7, dailySales30, topCustomers, churnCustomers, metrics7, metrics30] =
    await Promise.all([
      getDailySales(7),
      getDailySales(30),
      getTopCustomers(10),
      getChurnRisk(),
      getPeriodMetrics(7),
      getPeriodMetrics(30),
    ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground text-sm">Análisis de ventas y comportamiento de clientes.</p>
      </div>
      <ReportsClient
        dailySales7={dailySales7}
        dailySales30={dailySales30}
        topCustomers={topCustomers}
        churnCustomers={churnCustomers}
        metrics7={metrics7}
        metrics30={metrics30}
      />
    </div>
  )
}
