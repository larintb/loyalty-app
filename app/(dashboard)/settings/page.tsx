import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/actions/settings'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const business = await getBusinessSettings()
  if (!business) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Administra tu negocio y las reglas de fidelización.
        </p>
      </div>
      <SettingsClient business={business} />
    </div>
  )
}
