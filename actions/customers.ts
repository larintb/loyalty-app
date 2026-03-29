'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import type { CustomerInsert } from '@/types/database'

type ActionState = { error: string } | null

// ─── Buscar cliente por teléfono (usado en POS) ───────────────────────────────

export async function searchCustomerByPhone(phone: string) {
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .maybeSingle()

  // Obtener el business_id del usuario actual
  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

  const normalized = normalizePhone(phone)

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, total_points, visit_count, last_visit_at')
    .eq('business_id', businessId)
    .eq('phone', normalized)
    .eq('is_active', true)
    .maybeSingle()

  return data
}

// ─── Registrar cliente nuevo ───────────────────────────────────────────────────

export async function registerCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { customerId?: string }> {
  const supabase = await createClient()

  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No se encontró el negocio.' }

  const phone = normalizePhone(formData.get('phone') as string)
  const name = (formData.get('name') as string).trim()
  const email = (formData.get('email') as string | null) || null
  const birthday = (formData.get('birthday') as string | null) || null

  if (!phone || phone.length < 10) {
    return { error: 'Teléfono inválido. Ingresa 10 dígitos.' }
  }
  if (!name) {
    return { error: 'El nombre es requerido.' }
  }

  // Verificar capacidad del plan (el trigger DB también lo valida)
  const { data: business } = await supabase
    .from('businesses')
    .select('plan_status, plan_id')
    .eq('id', businessId)
    .single()

  if (!business) return { error: 'Negocio no encontrado.' }

  if (!['active', 'trialing'].includes(business.plan_status)) {
    return { error: 'Suscripción inactiva. Actualiza tu plan para registrar clientes.' }
  }

  // Verificar capacidad según el plan
  if (business.plan_id) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('max_customers')
      .eq('id', business.plan_id)
      .single()

    if (plan?.max_customers != null) {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)

      if ((count ?? 0) >= plan.max_customers) {
        return {
          error: `Límite de ${plan.max_customers} clientes alcanzado. Actualiza tu plan.`,
        }
      }
    }
  }

  const insert: CustomerInsert = { business_id: businessId, phone, name, email, birthday }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert(insert)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este número ya está registrado en tu negocio.' }
    }
    // Errores del trigger de capacidad
    if (error.message?.includes('capacity_exceeded')) {
      return { error: 'Límite de clientes alcanzado. Actualiza tu plan.' }
    }
    return { error: 'Error al registrar el cliente. Intenta de nuevo.' }
  }

  // Bono de bienvenida si está configurado
  const { data: bizConfig } = await supabase
    .from('businesses')
    .select('points_config')
    .eq('id', businessId)
    .single()

  const welcomeBonus = bizConfig?.points_config?.welcome_bonus ?? 0

  if (welcomeBonus > 0) {
    await supabase.from('points_ledger').insert({
      business_id: businessId,
      customer_id: customer.id,
      type: 'welcome',
      points_delta: welcomeBonus,
      balance_after: welcomeBonus,
      note: 'Bono de bienvenida',
    })
  }

  return { error: null as unknown as string, customerId: customer.id }
}

// ─── Obtener perfil completo del cliente ──────────────────────────────────────

export async function getCustomerProfile(customerId: string) {
  const supabase = await createClient()

  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (!customer) return null

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, total, items, ticket_number, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: pointsHistory } = await supabase
    .from('points_ledger')
    .select('type, points_delta, balance_after, note, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)

  return { customer, transactions: transactions ?? [], pointsHistory: pointsHistory ?? [] }
}

// ─── Listar clientes del negocio ──────────────────────────────────────────────

export async function getCustomers(search?: string) {
  const supabase = await createClient()

  const businessId = await getBusinessId(supabase)
  if (!businessId) return []

  let query = supabase
    .from('customers')
    .select('id, name, phone, email, total_points, lifetime_spend, visit_count, last_visit_at, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    const normalized = normalizePhone(search)
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${normalized}%`)
  }

  const { data } = await query
  return data ?? []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
