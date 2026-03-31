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
      {access.showBanner && !access.isTrial && (
        <PlanBanner
          featureLabel={FEATURE_LABELS.campaigns}
          requiredPlanName={access.requiredPlanName!}
          daysLeft={access.daysLeft}
        />
      )}

      {access.isTrial && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Estás en trial: campañas ilimitadas por promoción</p>
          <p className="mt-1 text-amber-800/90">
            Durante tu periodo de prueba puedes enviar campañas sin límite.
            {access.daysLeft > 0 ? ` Te quedan ${access.daysLeft} días de trial.` : ''} Al terminar,
            para mantener campañas ilimitadas necesitas el plan Premium.
          </p>
        </div>
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
