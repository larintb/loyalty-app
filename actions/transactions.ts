'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateEarnedPoints, calculateRedemptionValue, canRedeem } from '@/lib/points/calculator'
import { sendTicketMessage } from '@/lib/whatsapp/client'
import type { FinancePeriodInsert, TransactionInsert } from '@/types/database'

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

function parseMonthRange(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const end = new Date(year, mon, 0)
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(end.getDate()).padStart(2, '0')}`,
  }
}

async function ensureMonthlyFinancePeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  dateISO: string
): Promise<{ id: string } | { error: string }> {
  const month = dateISO.slice(0, 7)
  const { startDate, endDate } = parseMonthRange(month)

  const { data: existingPeriod } = await supabase
    .from('finance_periods')
    .select('id, status')
    .eq('business_id', businessId)
    .eq('period_type', 'month')
    .eq('period_start', startDate)
    .eq('period_end', endDate)
    .maybeSingle()

  if (existingPeriod) {
    // Permite ventas incluso si el período está cerrado (no es limitante)
    return { id: existingPeriod.id }
  }

  const { data: previousClosed } = await supabase
    .from('finance_periods')
    .select('closing_balance')
    .eq('business_id', businessId)
    .eq('period_type', 'month')
    .eq('status', 'closed')
    .lt('period_start', startDate)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const insert: FinancePeriodInsert = {
    business_id: businessId,
    period_type: 'month',
    period_start: startDate,
    period_end: endDate,
    status: 'open',
    opening_balance: Number(previousClosed?.closing_balance ?? 0),
    total_income: 0,
    total_expense: 0,
    closing_balance: Number(previousClosed?.closing_balance ?? 0),
    reset_mode: 'carry_over',
  }

  // ON CONFLICT handles the race condition where two simultaneous first-sales
  // of the month both try to create the period.
  const { error: insertError } = await supabase
    .from('finance_periods')
    .insert(insert)
    .select('id')
    .single()

  if (insertError && insertError.code !== '23505') {
    // 23505 = unique_violation (already created by a concurrent request)
    return { error: 'Error al crear período financiero.' }
  }

  // Re-select to get the id whether we just created it or it already existed.
  const { data: period } = await supabase
    .from('finance_periods')
    .select('id')
    .eq('business_id', businessId)
    .eq('period_type', 'month')
    .eq('period_start', startDate)
    .eq('period_end', endDate)
    .single()

  if (!period) return { error: 'No se pudo obtener el período financiero.' }

  return { id: period.id }
}

export async function createSale(payload: SalePayload): Promise<SaleResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado.' }

  // Fetch business (owner) and staff membership in parallel
  const [{ data: ownerBusiness }, { data: staffRecord }] = await Promise.all([
    supabase.from('businesses').select('id, points_config').eq('owner_id', user.id).maybeSingle(),
    supabase.from('staff_members').select('id, business_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  const businessId = ownerBusiness?.id ?? staffRecord?.business_id ?? null
  if (!businessId) return { success: false, error: 'Negocio no encontrado.' }

  const staffId = ownerBusiness ? null : (staffRecord?.id ?? null)

  // If owner, we already have points_config; if staff, fetch it now
  let config = ownerBusiness?.points_config
  if (!config) {
    const { data: biz } = await supabase.from('businesses').select('points_config').eq('id', businessId).single()
    if (!biz) return { success: false, error: 'Negocio no encontrado.' }
    config = biz.points_config
  }

  const saleDateISO = new Date().toISOString().split('T')[0]

  // Fetch finance period and customer balance in parallel
  const [financePeriod, customerResult] = await Promise.all([
    ensureMonthlyFinancePeriod(supabase, businessId, saleDateISO),
    payload.customerId
      ? supabase.from('customers').select('total_points, name').eq('id', payload.customerId).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if ('error' in financePeriod) {
    return { success: false, error: financePeriod.error }
  }

  const subtotal = payload.total
  const discount = payload.discount ?? 0

  let pointsRedeemed = 0
  let discountByPoints = 0
  let customerCurrentBalance = 0

  if (payload.customerId) {
    const customer = customerResult.data
    if (!customer) return { success: false, error: 'Cliente no encontrado.' }

    customerCurrentBalance = customer.total_points

    if ((payload.pointsToRedeem ?? 0) > 0) {
      const validation = canRedeem(payload.pointsToRedeem!, customerCurrentBalance, config)

      if (!validation.allowed) {
        return { success: false, error: validation.reason ?? 'No se puede canjear.' }
      }

      pointsRedeemed = payload.pointsToRedeem!
      discountByPoints = calculateRedemptionValue(pointsRedeemed, config)
    }
  }

  const total = Math.max(0, subtotal - discount - discountByPoints)

  // Puntos ganados sobre el total final pagado (con multiplicador opcional)
  const multiplier = [1, 2, 3].includes(payload.pointsMultiplier as number) ? payload.pointsMultiplier! : 1
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

  // ── Ledger de puntos (atómico con SELECT FOR UPDATE) ───────────────────────
  let newBalance = customerCurrentBalance

  if (payload.customerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcRows, error: rpcError } = await (supabase as any).rpc('process_points_atomic', {
      p_business_id:    businessId,
      p_customer_id:    payload.customerId,
      p_points_redeem:  pointsRedeemed,
      p_points_earn:    pointsEarned,
      p_transaction_id: transaction.id,
      p_ticket_number:  transaction.ticket_number ?? '',
    })

    if (rpcError) {
      console.error('[createSale] points RPC error:', rpcError)
      return { success: false, error: 'Error al procesar puntos.' }
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (rpcResult?.error_msg) {
      return { success: false, error: rpcResult.error_msg }
    }

    newBalance = rpcResult?.new_balance ?? customerCurrentBalance

    // Actualizar stats del cliente (lifetime_spend, visit_count)
    const { data: currentCustomer } = await supabase
      .from('customers')
      .select('lifetime_spend, visit_count')
      .eq('id', payload.customerId)
      .single()

    await supabase
      .from('customers')
      .update({
        lifetime_spend: (currentCustomer?.lifetime_spend ?? 0) + total,
        visit_count:    (currentCustomer?.visit_count ?? 0) + 1,
        last_visit_at:  new Date().toISOString(),
      })
      .eq('id', payload.customerId)
  }

  // ── Finance entry (ingreso automático) ─────────────────────────────────────
  await supabase.from('finance_entries').insert({
    business_id: businessId,
    staff_id: staffId,
    period_id: financePeriod.id,
    transaction_id: transaction.id,
    type: 'income',
    category: 'venta',
    amount: total,
    description: `Ticket ${transaction.ticket_number}`,
    date: saleDateISO,
    locked: false,
  })

  const customerName: string | null = payload.customerId
    ? (customerResult.data?.name ?? null)
    : null

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
