import { getCampaignPageData } from '@/actions/campaigns'
import { CampaignsClient } from './campaigns-client'

export default async function CampaignsPage() {
  const data = await getCampaignPageData()

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold">Campanas WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Mensajes masivos con limites de seguridad para evitar spam.
        </p>
      </div>

      <CampaignsClient initialData={data} />
    </div>
  )
}
