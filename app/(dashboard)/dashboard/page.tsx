import { redirect } from 'next/navigation'
import { getPlanAccess } from '@/lib/plan-access'
import { getDashboardMetrics } from '@/actions/finance'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const access = await getPlanAccess()
  if (!access.canAccess) redirect('/settings/billing')

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
