import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getCachedUser,
  getCachedBusinessOwnerData,
  getCachedStaffRecord,
  getCachedSubscriptionPlan,
} from '@/lib/auth-context'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  // Fetch owner business data, staff record, and subscription plan in parallel.
  // All three are cached — page-level calls to getPlanAccess/getCachedBusinessId hit the cache.
  const [biz, staff, plan] = await Promise.all([
    getCachedBusinessOwnerData(),
    getCachedStaffRecord(),
    getCachedSubscriptionPlan(),
  ])

  // Staff that are not owners: fetch the business name separately
  let staffBusinessName: string | null = null
  if (!biz && staff?.business_id) {
    const supabase = await createClient()
    const { data: staffBiz } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', staff.business_id)
      .maybeSingle()
    staffBusinessName = (staffBiz as { name: string } | null)?.name ?? null
  }

  const planStatus: string | null = biz?.plan_status ?? null
  const hasActivePlan = ['active', 'trialing', 'cancelling'].includes(planStatus ?? '')
  const planSlug: string | null = hasActivePlan ? (plan?.slug ?? null) : null
  const planName: string | null = hasActivePlan ? (plan?.name ?? null) : null

  const cancellingEndsAt: string | null = planStatus === 'cancelling'
    ? (biz?.current_period_end ?? null)
    : null

  const trialEndsAt: string | null = biz?.trial_ends_at ?? null
  const now = new Date()
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const isTrial = planStatus === 'trialing' && !!trialEnd && trialEnd > now
  const daysLeft = isTrial && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const businessName: string = biz?.name ?? staffBusinessName ?? 'Mi negocio'
  const businessLogoUrl: string | null = biz?.logo_url ?? null

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
        {cancellingEndsAt && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between gap-4">
            <p className="text-sm text-rose-800">
              <span className="font-semibold">Tu suscripción fue cancelada.</span>
              {' '}Tu acceso termina el{' '}
              <span className="font-semibold">
                {new Date(cancellingEndsAt).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>.
            </p>
            <Link
              href="/settings/billing"
              className="shrink-0 text-xs font-medium text-rose-700 underline underline-offset-2 hover:text-rose-900"
            >
              Renovar plan
            </Link>
          </div>
        )}
        <div className="container mx-auto px-4 py-6 pb-24 lg:pb-6 max-w-7xl">
          {children}
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
