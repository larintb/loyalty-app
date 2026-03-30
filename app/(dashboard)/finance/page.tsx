import { getPlanAccess } from '@/lib/plan-access'
import { FEATURE_LABELS } from '@/lib/plans'
import { PlanBanner, UpgradeWall } from '@/components/dashboard/plan-banner'
import { getFinanceEntries, getFinancePeriod } from '@/actions/finance'
import { FinanceClient } from './finance-client'

export default async function FinancePage() {
  const access = await getPlanAccess('finance')

  if (!access.canAccess) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 page-enter">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
        </div>
        <UpgradeWall
          featureLabel={FEATURE_LABELS.finance}
          currentPlanName={access.planName}
          requiredPlanName={access.requiredPlanName!}
        />
      </div>
    )
  }

  const now = new Date()
  const period = await getFinancePeriod()
  const entries = await getFinanceEntries(period?.month)

  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

  const monthSource = period ? new Date(`${period.month}-01T12:00:00`) : now
  const monthLabel = monthSource.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl space-y-4 page-enter">
      {access.showBanner && (
        <PlanBanner
          featureLabel={FEATURE_LABELS.finance}
          requiredPlanName={access.requiredPlanName!}
          daysLeft={access.daysLeft}
        />
      )}
      <div>
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <p className="text-muted-foreground text-sm capitalize">{monthLabel}</p>
      </div>
      <FinanceClient
        entries={entries}
        period={period}
        summary={{ income, expense, profit: income - expense }}
      />
    </div>
  )
}
