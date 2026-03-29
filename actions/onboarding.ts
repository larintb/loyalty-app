'use server'

import { createClient } from '@/lib/supabase/server'
import type { PointsConfig } from '@/types/database'

type OnboardingPayload = {
  businessId: string
  name: string
  phone?: string
  address?: string
  pointsConfig: PointsConfig
  planId?: string
}

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: payload.name,
      phone: payload.phone || null,
      address: payload.address || null,
      points_config: payload.pointsConfig,
      plan_id: payload.planId || null,
      onboarding_completed: true,
    })
    .eq('id', payload.businessId)
    .eq('owner_id', user.id)

  if (error) {
    return { error: 'Error al guardar la configuración.' }
  }

  return { success: true }
}
