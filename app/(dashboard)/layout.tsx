import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('id, name, plan_status, logo_url, plan_id, trial_ends_at' as any)
    .eq('owner_id', user.id)
    .maybeSingle()

  // Staff que no es owner: obtener nombre del negocio por separado
  let staffBusinessName: string | null = null
  if (!business) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staffRecord } = await (supabase as any)
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffRecord?.business_id) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', staffRecord.business_id)
        .maybeSingle()
      staffBusinessName = biz?.name ?? null
    }
  }

  // Resolve plan name for sidebar indicator
  let planSlug: string | null = null
  let planName: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planId = (business as any)?.plan_id ?? null
  if (planId) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('slug, name' as any)
      .eq('id', planId)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planSlug = (plan as any)?.slug ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planName = (plan as any)?.name ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trialEndsAt: string | null = (business as any)?.trial_ends_at ?? null
  const now = new Date()
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTrial = (business as any)?.plan_status === 'trialing' && !!trialEnd && trialEnd > now
  const daysLeft = isTrial && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessName = (business as any)?.name ?? staffBusinessName ?? 'Mi negocio'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessLogoUrl = (business as any)?.logo_url ?? null

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <Sidebar
        businessName={businessName}
        logoUrl={businessLogoUrl}
        planSlug={planSlug}
        planName={planName}
        isTrial={isTrial}
        daysLeft={daysLeft}
      />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 pb-24 lg:pb-6 max-w-7xl">
          {children}
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
