import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPlanAccess } from '@/lib/plan-access'
import { POSClient } from './pos-client'
import type { RedeemableProductRow } from '@/types/database'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function POSPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getPlanAccess()
  if (!access.canAccess) redirect('/settings/billing')

  // Obtener config de puntos del negocio
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, points_config, plan_status')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Si es staff
  let pointsConfig = business?.points_config
  let planStatus = business?.plan_status
  let businessId = business?.id

  if (!business) {
    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (staff?.business_id) {
      businessId = staff.business_id
      const { data: biz } = await supabase
        .from('businesses')
        .select('points_config, plan_status')
        .eq('id', staff.business_id)
        .single()
      pointsConfig = biz?.points_config
      planStatus = biz?.plan_status
    }
  }

  if (!['active', 'trialing'].includes(planStatus ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Suscripción inactiva</h2>
        <p className="text-muted-foreground mb-4">
          Activa tu plan para usar el punto de venta.
        </p>
      </div>
    )
  }

  // Obtener productos canjeables
  const { data: redeemables } = await supabase
    .from('redeemable_products' as any)
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Punto de Venta</h1>
      <POSClient 
        pointsConfig={pointsConfig!} 
        redeemableProducts={(redeemables as any as RedeemableProductRow[]) || []} 
      />
    </div>
  )
}
