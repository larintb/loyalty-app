import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getBusinessSettings } from '@/actions/settings'
import { SettingsClient, TrialBadge } from './settings-client'

export default async function SettingsPage() {
  const business = await getBusinessSettings()
  if (!business) redirect('/login')

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground text-sm">
            Administra tu negocio y las reglas de fidelización.
          </p>
        </div>
        <Link href="/settings/billing" className="shrink-0">
          <TrialBadge trialEndsAt={business.trial_ends_at ?? null} planStatus={business.plan_status ?? null} />
        </Link>
      </div>
      <SettingsClient business={business} />
    </div>
  )
}
