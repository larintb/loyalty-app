import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardingClient } from './onboarding-client'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, onboarding_completed')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/register')

  // Si ya completó onboarding, ir al dashboard
  if (business.onboarding_completed) redirect('/dashboard')

  // Obtener planes disponibles
  const admin = createAdminClient()
  const { data: plans } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_mxn')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">¡Bienvenido a Puntaje!</h1>
          <p className="text-muted-foreground mt-2">
            Configura tu negocio en 2 pasos para empezar a fidelizar clientes.
          </p>
        </div>
        <OnboardingClient
          businessId={business.id}
          businessName={business.name}
          plans={plans ?? []}
        />
      </div>
    </div>
  )
}
