import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardingClient } from './onboarding-client'

type OnboardingPageProps = {
  searchParams?: Promise<{ checkout?: string; session_id?: string }>
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const checkoutStatus = params?.checkout
  const checkoutSessionId = params?.session_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, onboarding_completed')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/register')

  if (business.onboarding_completed) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: plans } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_mxn')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <span className="font-bold text-lg tracking-tight">Puntaje</span>
        <span className="text-xs text-muted-foreground">Configuración inicial</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <OnboardingClient
            businessId={business.id}
            businessName={business.name}
            plans={plans ?? []}
            checkoutStatus={checkoutStatus}
            checkoutSessionId={checkoutSessionId}
          />
        </div>
      </div>
    </div>
  )
}
