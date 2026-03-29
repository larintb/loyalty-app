'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateEarnedPoints, calculateRedemptionValue, canRedeem } from '@/lib/points/calculator'
import { sendTicketMessage } from '@/lib/whatsapp/client'
import type { TransactionInsert } from '@/types/database'

export type SalePayload = {
  customerId: string | null
  total: number             // total del ticket ingresado en el POS
  discount?: number
  pointsToRedeem?: number
  pointsMultiplier?: 1 | 2 | 3   // bonus de puntos para la venta
}

export type SaleResult =
  | {
      success: true
      transactionId: string
      ticketNumber: string
      pointsEarned: number
      pointsRedeemed: number
      discountByPoints: number
      newBalance: number
      total: number
      customerName: string | null
    }
  | { success: false; error: string }

export async function createSale(payload: SalePayload): Promise<SaleResult> {
  const supabase = await createClient()

  // Obtener contexto del usuario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado.' }

  const businessId = await getBusinessId(supabase, user.id)
  if (!businessId) return { success: false, error: 'Negocio no encontrado.' }

  const staffId = await getStaffId(supabase, user.id, businessId)

  // Obtener config de puntos del negocio
  const { data: business } = await supabase
    .from('businesses')
    .select('points_config')
    .eq('id', businessId)
    .single()

  if (!business) return { success: false, error: 'Negocio no encontrado.' }

  const config = business.points_config

  const subtotal = payload.total
  const discount = payload.discount ?? 0

  // Validar y calcular redención de puntos
  let pointsRedeemed = 0
  let discountByPoints = 0
  let customerCurrentBalance = 0

  if (payload.customerId && (payload.pointsToRedeem ?? 0) > 0) {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_points, name')
      .eq('id', payload.customerId)
      .single()

    if (!customer) return { success: false, error: 'Cliente no encontrado.' }

    customerCurrentBalance = customer.total_points
    const validation = canRedeem(payload.pointsToRedeem!, customerCurrentBalance, config)

    if (!validation.allowed) {
      return { success: false, error: validation.reason ?? 'No se puede canjear.' }
    }

    pointsRedeemed = payload.pointsToRedeem!
    discountByPoints = calculateRedemptionValue(pointsRedeemed, config)
  }

  const total = Math.max(0, subtotal - discount - discountByPoints)

  // Puntos ganados sobre el total final pagado (con multiplicador opcional)
  const multiplier = payload.pointsMultiplier ?? 1
  const pointsEarned = payload.customerId
    ? calculateEarnedPoints(total, config) * multiplier
    : 0

  // ── Insertar transacción ────────────────────────────────────────────────────
  const insert: TransactionInsert = {
    business_id: businessId,
    customer_id: payload.customerId,
    staff_id: staffId,
    type: 'sale',
    subtotal,
    discount,
    points_redeemed: pointsRedeemed,
    discount_by_points: discountByPoints,
    total,
    items: [],
  }

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert(insert)
    .select('id, ticket_number')
    .single()

  if (txError || !transaction) {
    console.error('[createSale] tx error:', txError)
    return { success: false, error: 'Error al registrar la venta.' }
  }

  // ── Ledger de puntos ────────────────────────────────────────────────────────
  let newBalance = customerCurrentBalance

  if (payload.customerId) {
    // 1. Primero descontar puntos canjeados
    if (pointsRedeemed > 0) {
      newBalance = customerCurrentBalance - pointsRedeemed
      await supabase.from('points_ledger').insert({
        business_id: businessId,
        customer_id: payload.customerId,
        transaction_id: transaction.id,
        type: 'redeem',
        points_delta: -pointsRedeemed,
        balance_after: newBalance,
        note: `Canje en ticket ${transaction.ticket_number}`,
      })
    }

    // 2. Agregar puntos ganados
    if (pointsEarned > 0) {
      newBalance = newBalance + pointsEarned
      await supabase.from('points_ledger').insert({
        business_id: businessId,
        customer_id: payload.customerId,
        transaction_id: transaction.id,
        type: 'earn',
        points_delta: pointsEarned,
        balance_after: newBalance,
        note: `Venta ticket ${transaction.ticket_number}`,
      })
    }

    // 3. Actualizar stats del cliente
    const { data: currentCustomer } = await supabase
      .from('customers')
      .select('lifetime_spend, visit_count')
      .eq('id', payload.customerId)
      .single()

    await supabase
      .from('customers')
      .update({
        lifetime_spend: (currentCustomer?.lifetime_spend ?? 0) + total,
        visit_count: (currentCustomer?.visit_count ?? 0) + 1,
        last_visit_at: new Date().toISOString(),
      })
      .eq('id', payload.customerId)
  }

  // ── Finance entry (ingreso automático) ─────────────────────────────────────
  await supabase.from('finance_entries').insert({
    business_id: businessId,
    staff_id: staffId,
    transaction_id: transaction.id,
    type: 'income',
    category: 'venta',
    amount: total,
    description: `Ticket ${transaction.ticket_number}`,
  })

  // Obtener nombre del cliente para el resultado
  let customerName: string | null = null
  if (payload.customerId) {
    const { data: c } = await supabase
      .from('customers')
      .select('name')
      .eq('id', payload.customerId)
      .single()
    customerName = c?.name ?? null
  }

  return {
    success: true,
    transactionId: transaction.id,
    ticketNumber: transaction.ticket_number!,
    pointsEarned,
    pointsRedeemed,
    discountByPoints,
    newBalance,
    total,
    customerName,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (business) return business.id

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return staff?.business_id ?? null
}

async function getStaffId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  businessId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .maybeSingle()

  return data?.id ?? null
}

// ─── Enviar ticket por WhatsApp ───────────────────────────────────────────────

export type WhatsAppTicketPayload = {
  transactionId: string
  customerPhone: string
  customerName: string
  ticketNumber: string
  total: number
  discountByPoints: number
  pointsEarned: number
  pointsBalance: number
}

export async function sendWhatsAppTicket(
  payload: WhatsAppTicketPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado.' }

  const businessId = await getBusinessId(supabase, user.id)
  if (!businessId) return { success: false, error: 'Negocio no encontrado.' }

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single()

  if (!business) return { success: false, error: 'Negocio no encontrado.' }

  const result = await sendTicketMessage({
    to: payload.customerPhone,
    businessName: business.name,
    ticketNumber: payload.ticketNumber,
    customerName: payload.customerName,
    items: [{ name: 'Total de compra', quantity: 1, price: payload.total }],
    subtotal: payload.total + payload.discountByPoints,
    discountByPoints: payload.discountByPoints,
    total: payload.total,
    pointsEarned: payload.pointsEarned,
    pointsBalance: payload.pointsBalance,
  })

  if (result.success) {
    // Marcar el ticket como enviado por WhatsApp
    await supabase
      .from('transactions')
      .update({ ticket_sent_via: ['whatsapp'] })
      .eq('id', payload.transactionId)
  }

  return result
}
