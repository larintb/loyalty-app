import { redirect } from 'next/navigation'
import { getPlanAccess } from '@/lib/plan-access'
import { FEATURE_LABELS } from '@/lib/plans'
import { PlanBanner, UpgradeWall } from '@/components/dashboard/plan-banner'
import { getDailySales, getTopCustomers, getChurnRisk, getPeriodMetrics } from '@/actions/reports'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const access = await getPlanAccess('reports')

  if (!access.canAccess) {
    const hasSubscription = ['active', 'trialing', 'cancelling'].includes(access.planStatus ?? '')
    if (!hasSubscription) redirect('/settings/billing')

    return (
      <div className="space-y-4 page-enter">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground text-sm">Análisis de ventas y comportamiento de clientes.</p>
        </div>
        <UpgradeWall
          featureLabel={FEATURE_LABELS.reports}
          currentPlanName={access.planName}
          requiredPlanName={access.requiredPlanName!}
        />
      </div>
    )
  }

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
    <div className="space-y-4 page-enter">
      {access.showBanner && (
        <PlanBanner
          featureLabel={FEATURE_LABELS.reports}
          requiredPlanName={access.requiredPlanName!}
          daysLeft={access.daysLeft}
        />
      )}
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
