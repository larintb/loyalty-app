import { getDashboardMetrics } from '@/actions/finance'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error cargando métricas.
      </div>
    )
  }

  return <DashboardClient metrics={metrics} />
}
