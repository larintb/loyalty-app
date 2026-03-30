import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanAccess } from '@/lib/plan-access'
import { syncCheckoutSession, syncSubscriptionFromStripe } from '@/actions/billing'
import { PlansGrid } from './plans-grid'
/* eslint-disable @typescript-eslint/no-explicit-any */

type BillingPageProps = {
  searchParams?: Promise<{ checkout?: string; session_id?: string; portal?: string }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = searchParams ? await searchParams : undefined
  const checkoutStatus = params?.checkout
  const checkoutSessionId = params?.session_id
  const isPortalReturn = params?.portal === 'return'

  // Sync real subscription state from Stripe when returning from portal
  if (isPortalReturn) {
    await syncSubscriptionFromStripe()
    redirect('/settings/billing')
  }

  let checkoutSyncError: string | null = null
  if (checkoutStatus === 'success' && checkoutSessionId) {
    const syncResult = await syncCheckoutSession(checkoutSessionId)
    if (!syncResult.success) {
      checkoutSyncError = syncResult.error
    } else {
      redirect('/settings/billing?checkout=success')
    }
  }

  const access = await getPlanAccess()

  const admin = createAdminClient()
  const { data: rawPlans } = await (admin as any)
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_mxn')

  const plans: any[] = rawPlans ?? []

  return (
    <div className="space-y-8 page-enter max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mi Plan</h1>
        <p className="text-muted-foreground text-sm">
          Elige o cambia tu plan y procesa el pago de forma segura con Stripe.
        </p>
      </div>

      {checkoutStatus === 'success' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Checkout completado. Tu suscripción se está sincronizando con Stripe.
        </div>
      )}

      {checkoutSyncError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          No se pudo sincronizar el plan automáticamente: {checkoutSyncError}
        </div>
      )}

      {checkoutStatus === 'cancelled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout cancelado. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}

      <PlansGrid access={access} plans={plans} />

      <p className="text-xs text-center text-muted-foreground pb-2">
        Si estás en trial, Stripe mostrará primero tus 7 días gratis y después solicitará la tarjeta para cobro automático al finalizar.
      </p>
    </div>
  )
}
