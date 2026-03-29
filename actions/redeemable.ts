'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  RedeemableProductInsert,
  RedeemableProductRow,
  RedemptionRow,
} from '@/types/database'

// ─── Helper: obtener business_id del usuario ──────────────────────────────────

async function getBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (business) return business.id

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return staff?.business_id ?? null
}

// ─── Obtener productos canjeables del negocio ──────────────────────────────────

export async function getBusinessRedeemables() {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado', data: null }
  }

  const { data, error } = await supabase
    .from('redeemable_products' as any)
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { error: null, data: (data || []) as any as RedeemableProductRow[] }
}

// ─── Obtener solo productos ACTIVOS (para POS) ─────────────────────────────────

export async function getActiveRedeemables() {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado', data: null }
  }

  const { data, error } = await supabase
    .from('redeemable_products' as any)
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { error: null, data: (data || []) as any as RedeemableProductRow[] }
}

// ─── Crear nuevo producto canjeable ────────────────────────────────────────────

export async function createRedeemableProduct(
  input: Omit<RedeemableProductInsert, 'business_id' | 'created_by'>
) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  const { data: { user } } = await supabase.auth.getUser()

  if (!businessId || !user) {
    return { error: 'No autorizado', id: null }
  }

  // Obtener staff_id del usuario
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!staff) {
    return { error: 'Staff no encontrado', id: null }
  }

  // Validaciones
  if (!input.name || input.name.trim().length === 0) {
    return { error: 'El nombre es obligatorio', id: null }
  }

  if (!input.points_cost || input.points_cost <= 0) {
    return { error: 'El costo en puntos debe ser mayor a 0', id: null }
  }

  const { data, error } = await supabase
    .from('redeemable_products' as any)
    .insert({
      business_id: businessId,
      created_by: staff.id,
      ...input,
    })
    .select('id')
    .single()

  if (error) {
    // Error por nombre duplicado
    if (error.code === '23505') {
      return { error: 'Ya existe un producto con ese nombre', id: null }
    }
    return { error: error.message, id: null }
  }

  return { error: null, id: (data as any).id }
}

// ─── Actualizar producto canjeable ────────────────────────────────────────────

export async function updateRedeemableProduct(
  productId: string,
  input: Partial<Omit<RedeemableProductInsert, 'business_id' | 'created_by'>>
) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado' }
  }

  // Validar que el producto pertenece al negocio actual
  const { data: product } = await supabase
    .from('redeemable_products' as any)
    .select('id')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!product) {
    return { error: 'Producto no encontrado' }
  }

  // Validaciones
  if (input.name && input.name.trim().length === 0) {
    return { error: 'El nombre no puede estar vacío' }
  }

  if (input.points_cost && input.points_cost <= 0) {
    return { error: 'El costo en puntos debe ser mayor a 0' }
  }

  const { error } = await supabase
    .from('redeemable_products' as any)
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('business_id', businessId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un producto con ese nombre' }
    }
    return { error: error.message }
  }

  return { error: null }
}

// ─── Eliminar producto canjeable ──────────────────────────────────────────────

export async function deleteRedeemableProduct(productId: string) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado' }
  }

  const { error } = await supabase
    .from('redeemable_products' as any)
    .delete()
    .eq('id', productId)
    .eq('business_id', businessId)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

// ─── Validar si se puede canjear un producto ──────────────────────────────────

export async function validateRedemption(
  productId: string,
  customerId: string
) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { isValid: false, reason: 'No autorizado', product: null }
  }

  // Llamar a la función PostgreSQL
  const { data, error } = await supabase
    .rpc('validate_redemption' as any, {
      p_customer_id: customerId,
      p_product_id: productId,
      p_business_id: businessId,
    })
    .single()

  if (error) {
    return {
      isValid: false,
      reason: `Error al validar: ${error.message}`,
      product: null,
    }
  }

  const result = data as any
  return {
    isValid: result.is_valid,
    reason: result.reason,
    product: {
      pointsCost: result.product_points_cost,
      customerPoints: result.customer_total_points,
      stockAvailable: result.stock_available,
    },
  }
}

// ─── Ejecutar canje de producto ────────────────────────────────────────────────

export async function redeemProduct(
  productId: string,
  customerId: string,
  notes?: string
) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  const { data: { user } } = await supabase.auth.getUser()

  if (!businessId || !user) {
    return { error: 'No autorizado', redemption: null }
  }

  // Obtener staff_id del usuario
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .maybeSingle()

  // Validar primero si se puede canjear
  const validation = await validateRedemption(productId, customerId)
  if (!validation.isValid) {
    return { error: validation.reason, redemption: null }
  }

  // Ejecutar canje usando la función PostgreSQL
  const { data, error } = await supabase
    .rpc('execute_redemption' as any, {
      p_customer_id: customerId,
      p_product_id: productId,
      p_business_id: businessId,
      p_redeemed_by_user_id: staff?.id || null,
      p_notes: notes || null,
    })
    .single()

  if (error) {
    return { error: error.message, redemption: null }
  }

  const result = data as any
  if (!result.success) {
    return { error: result.error_message, redemption: null }
  }

  return {
    error: null,
    redemption: {
      id: result.redemption_id,
      product_id: productId,
      points_deducted: validation.product?.pointsCost || 0,
      new_balance: result.new_balance,
    },
  }
}

// ─── Obtener historial de canjes de un cliente ─────────────────────────────────

export async function getCustomerRedemptions(customerId: string) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado', data: null }
  }

  const { data, error } = await supabase
    .from('redemptions' as any)
    .select('*, redeemable_products(name, emoji)')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { error: null, data: (data || []) as any }
}

// ─── Reportes: productos más canjeados (últimos 30 días) ───────────────────────

export async function getTopRedeemedProducts() {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado', data: null }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('redemptions' as any)
    .select('redeemable_product_id, redeemable_products(name, emoji)')
    .eq('business_id', businessId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) {
    return { error: error.message, data: null }
  }

  // Agrupar y contar
  const grouped = (data || []).reduce(
    (acc: any, r: any) => {
      const productId = r.redeemable_product_id
      if (!acc[productId]) {
        acc[productId] = {
          count: 0,
          name: r.redeemable_products?.name || 'Unknown',
          emoji: r.redeemable_products?.emoji || '🎁',
        }
      }
      acc[productId].count += 1
      return acc
    },
    {} as Record<string, { count: number; name: string; emoji: string }>
  )

  const result = Object.entries(grouped)
    .map(([id, data]: any) => ({ id, ...data }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10)

  return { error: null, data: result }
}

// ─── Reportes: total de puntos canjeados por período ──────────────────────────

export async function getTotalPointsRedeemed(
  period: 'today' | 'week' | 'month' | 'all' = 'month'
) {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)

  if (!businessId) {
    return { error: 'No autorizado', total: 0 }
  }

  let startDate = new Date()

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7)
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1)
  } else if (period === 'all') {
    startDate = new Date('2000-01-01')
  }

  const { data, error } = await supabase
    .from('redemptions' as any)
    .select('points_deducted')
    .eq('business_id', businessId)
    .gte('created_at', startDate.toISOString())

  if (error) {
    return { error: error.message, total: 0 }
  }

  const total = (data || []).reduce((sum: number, r: any) => sum + r.points_deducted, 0)

  return { error: null, total }
}
