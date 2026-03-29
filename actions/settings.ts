'use server'

import { createClient } from '@/lib/supabase/server'
import type { PointsConfig, RedeemableProductRow } from '@/types/database'

export async function getBusinessSettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('businesses')
    .select('id, name, phone, address, email, points_config')
    .eq('owner_id', user.id)
    .single()

  if (!data) return null

  // También obtener productos canjeables
  const { data: redeemables } = await supabase
    .from('redeemable_products' as any)
    .select('*')
    .eq('business_id', data.id)
    .order('created_at', { ascending: false })

  return {
    ...data,
    redeemable_products: (redeemables || []) as unknown as RedeemableProductRow[],
  }
}

export async function updateBusinessInfo(payload: {
  name: string
  phone?: string
  address?: string
  email?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  if (!payload.name.trim()) return { error: 'El nombre del negocio es requerido.' }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      email: payload.email?.trim() || null,
    })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar los datos del negocio.' }
  return { success: true }
}

export async function updatePointsConfig(
  config: PointsConfig
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase
    .from('businesses')
    .update({ points_config: config })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar la configuración de puntos.' }
  return { success: true }
}
