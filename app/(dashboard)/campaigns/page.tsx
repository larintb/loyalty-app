import { redirect } from 'next/navigation'
import { getPlanAccess } from '@/lib/plan-access'
import { PlanBanner, UpgradeWall } from '@/components/dashboard/plan-banner'
import { FEATURE_LABELS } from '@/lib/plans'
import { getCampaignPageData } from '@/actions/campaigns'
import { CampaignsClient } from './campaigns-client'

export default async function CampaignsPage() {
  const access = await getPlanAccess('campaigns')

  if (!access.canAccess) {
    const hasSubscription = ['active', 'trialing', 'cancelling'].includes(access.planStatus ?? '')
    if (!hasSubscription) redirect('/settings/billing')

    return (
      <div className="space-y-6 page-enter">
        <div>
          <h1 className="text-2xl font-bold">Campañas WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Mensajes masivos con límites de seguridad para evitar spam.</p>
        </div>
        <UpgradeWall
          featureLabel={FEATURE_LABELS.campaigns}
          currentPlanName={access.planName}
          requiredPlanName={access.requiredPlanName!}
        />
      </div>
    )
  }

  const data = await getCampaignPageData()

  return (
    <div className="space-y-5 page-enter">
      {access.showBanner && (
        <PlanBanner
          featureLabel={FEATURE_LABELS.campaigns}
          requiredPlanName={access.requiredPlanName!}
          daysLeft={access.daysLeft}
        />
      )}
      <div>
        <h1 className="text-2xl font-bold">Campañas WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Mensajes masivos con límites de seguridad para evitar spam.
        </p>
      </div>
      <CampaignsClient initialData={data} />
    </div>
  )
}
