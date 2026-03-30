'use server'

import { createClient } from '@/lib/supabase/server'
import type { PointsConfig } from '@/types/database'

type OnboardingPayload = {
  name: string
  phone?: string
  address?: string
  pointsConfig: PointsConfig
  planId?: string
  markCompleted?: boolean
}

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  // Derivar businessId del usuario autenticado — nunca confiar en el cliente
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) return { error: 'Negocio no encontrado.' }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: payload.name,
      phone: payload.phone || null,
      address: payload.address || null,
      points_config: payload.pointsConfig,
      plan_id: payload.planId || null,
      onboarding_completed: payload.markCompleted ?? false,
    })
    .eq('id', business.id)
    .eq('owner_id', user.id)

  if (error) {
    return { error: 'Error al guardar la configuración.' }
  }

  return { success: true }
}
