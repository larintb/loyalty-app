'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedBusinessId } from '@/lib/auth-context'
import type {
  FinanceEntryInsert,
  FinancePeriodInsert,
  FinanceResetMode,
} from '@/types/database'

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

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonthRange(month?: string) {
  const monthKey = month ?? toMonthKey(new Date())
  const [year, mon] = monthKey.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0)
  const nextStart = new Date(year, mon, 1)
  const startDate = `${monthKey}-01`
  const endDate = `${monthKey}-${String(end.getDate()).padStart(2, '0')}`
  const nextMonth = toMonthKey(nextStart)

  return {
    monthKey,
    startDate,
    endDate,
    nextMonth,
    periodStartISO: start.toISOString(),
  }
}

function monthFromDateString(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return toMonthKey(date)
}

async function getFirstSaleMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<string | null> {
  const { data: firstSale } = await supabase
    .from('transactions')
    .select('created_at')
    .eq('business_id', businessId)
    .eq('type', 'sale')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!firstSale?.created_at) return null
  return monthFromDateString(firstSale.created_at.split('T')[0])
}

async function ensureMonthlyPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  month?: string,
  resetMode: FinanceResetMode = 'carry_over'
) {
  let targetMonth: string | null | undefined = month

  if (!targetMonth) {
    const { data: latestPeriod } = await supabase
      .from('finance_periods')
      .select('period_start')
      .eq('business_id', businessId)
      .eq('period_type', 'month')
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestPeriod?.period_start) {
      targetMonth = latestPeriod.period_start.slice(0, 7)
    } else {
      targetMonth = await getFirstSaleMonth(supabase, businessId)
      if (!targetMonth) return null
    }
  }

  const { monthKey, startDate, endDate, periodStartISO } = parseMonthRange(targetMonth)

  const { data: existing } = await supabase
    .from('finance_periods')
    .select(
      'id, period_start, period_end, status, opening_balance, total_income, total_expense, closing_balance, reset_mode'
    )
    .eq('business_id', businessId)
    .eq('period_type', 'month')
    .eq('period_start', startDate)
    .eq('period_end', endDate)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id,
      month: monthKey,
      periodStart: existing.period_start,
      periodEnd: existing.period_end,
      status: existing.status as 'open' | 'closed',
      openingBalance: Number(existing.opening_balance),
      totalIncome: Number(existing.total_income),
      totalExpense: Number(existing.total_expense),
      closingBalance: Number(existing.closing_balance),
      resetMode: existing.reset_mode as FinanceResetMode,
    }
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
    reset_mode: resetMode,
  }

  const { data: created, error } = await supabase
    .from('finance_periods')
    .insert(insert)
    .select(
      'id, period_start, period_end, status, opening_balance, total_income, total_expense, closing_balance, reset_mode'
    )
    .single()

  if (error || !created) {
    throw new Error('No se pudo crear el periodo financiero.')
  }

  return {
    id: created.id,
    month: monthKey,
    periodStart: created.period_start,
    periodEnd: created.period_end,
    status: created.status as 'open' | 'closed',
    openingBalance: Number(created.opening_balance),
    totalIncome: Number(created.total_income),
    totalExpense: Number(created.total_expense),
    closingBalance: Number(created.closing_balance),
    resetMode: created.reset_mode as FinanceResetMode,
    periodStartISO,
  }
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export type DashboardMetrics = {
  totalCustomers: number
  salesToday: number
  salesMonth: number
  profitMonth: number
  recentTransactions: {
    id: string
    ticket_number: string | null
    total: number
    created_at: string
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const businessId = await getCachedBusinessId()
  if (!businessId) return null

  const supabase = await createClient()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { count: totalCustomers },
    { data: todaySales },
    { data: monthSales },
    { data: monthFinance },
    { data: recentTx },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('transactions')
      .select('total')
      .eq('business_id', businessId)
      .eq('type', 'sale')
      .gte('created_at', `${todayStr}T00:00:00`),
    supabase
      .from('transactions')
      .select('total')
      .eq('business_id', businessId)
      .eq('type', 'sale')
      .gte('created_at', `${monthStart}T00:00:00`),
    supabase
      .from('finance_entries')
      .select('type, amount')
      .eq('business_id', businessId)
      .gte('date', monthStart),
    supabase
      .from('transactions')
      .select('id, ticket_number, total, created_at')
      .eq('business_id', businessId)
      .eq('type', 'sale')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const salesToday = (todaySales ?? []).reduce((sum, t) => sum + Number(t.total), 0)
  const salesMonth = (monthSales ?? []).reduce((sum, t) => sum + Number(t.total), 0)
  const incomeMonth = (monthFinance ?? [])
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const expenseMonth = (monthFinance ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  return {
    totalCustomers: totalCustomers ?? 0,
    salesToday,
    salesMonth,
    profitMonth: incomeMonth - expenseMonth,
    recentTransactions: (recentTx ?? []).map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      total: Number(t.total),
      created_at: t.created_at,
    })),
  }
}

// ─── Finance Entries ──────────────────────────────────────────────────────────

export type FinanceEntryView = {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string | null
  date: string
  created_at: string
}

export type FinancePeriodView = {
  id: string
  month: string
  periodStart: string
  periodEnd: string
  status: 'open' | 'closed'
  openingBalance: number
  totalIncome: number
  totalExpense: number
  projectedClosing: number
  closingBalance: number
  resetMode: FinanceResetMode
}

export async function getFinancePeriod(month?: string): Promise<FinancePeriodView | null> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

  const period = await ensureMonthlyPeriod(supabase, businessId, month)
  if (!period) return null

  const { data: monthEntries } = await supabase
    .from('finance_entries')
    .select('type, amount')
    .eq('business_id', businessId)
    .gte('date', period.periodStart)
    .lte('date', period.periodEnd)

  const totalIncome = (monthEntries ?? [])
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const totalExpense = (monthEntries ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const projectedClosing = period.openingBalance + totalIncome - totalExpense

  return {
    id: period.id,
    month: period.month,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    status: period.status,
    openingBalance: period.openingBalance,
    totalIncome,
    totalExpense,
    projectedClosing,
    closingBalance: period.status === 'closed' ? period.closingBalance : projectedClosing,
    resetMode: period.resetMode,
  }
}

export async function getFinanceEntries(month?: string): Promise<FinanceEntryView[]> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return []

  const period = await ensureMonthlyPeriod(supabase, businessId, month)
  if (!period) return []

  const { data } = await supabase
    .from('finance_entries')
    .select('id, type, category, amount, description, date, created_at')
    .eq('business_id', businessId)
    .gte('date', period.periodStart)
    .lte('date', period.periodEnd)
    .order('date', { ascending: false })

  return (data ?? []).map((e) => ({
    id: e.id,
    type: e.type as 'income' | 'expense',
    category: e.category,
    amount: Number(e.amount),
    description: e.description ?? null,
    date: e.date,
    created_at: e.created_at,
  }))
}

export type FinanceEntryPayload = {
  type: 'income' | 'expense'
  category: string
  amount: number
  description?: string
  date?: string
}

export async function createFinanceEntry(
  payload: FinanceEntryPayload
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No autenticado.' }

  const { data: { user } } = await supabase.auth.getUser()
  const targetDate = payload.date ?? new Date().toISOString().split('T')[0]
  const period = await ensureMonthlyPeriod(supabase, businessId, monthFromDateString(targetDate))
  if (!period) return { error: 'No se pudo obtener el periodo financiero.' }

  if (period.status === 'closed') {
    return { error: 'El periodo financiero está cerrado. Abre el siguiente mes para registrar movimientos.' }
  }

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('business_id', businessId)
    .maybeSingle()

  const insert: FinanceEntryInsert = {
    business_id: businessId,
    staff_id: staff?.id ?? null,
    period_id: period.id,
    type: payload.type,
    category: payload.category,
    amount: payload.amount,
    description: payload.description || null,
    date: targetDate,
    locked: false,
  }

  const { error } = await supabase.from('finance_entries').insert(insert)
  if (error) return { error: 'Error al guardar la entrada.' }

  return { success: true }
}

export async function closeFinanceMonth(
  month?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No autenticado.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const period = await ensureMonthlyPeriod(supabase, businessId, month)
  if (!period) return { error: 'Aún no hay ventas registradas para iniciar un periodo.' }
  if (period.status === 'closed') {
    return { error: 'Este periodo ya está cerrado.' }
  }

  const { data: monthEntries } = await supabase
    .from('finance_entries')
    .select('id, type, amount')
    .eq('business_id', businessId)
    .gte('date', period.periodStart)
    .lte('date', period.periodEnd)

  const totalIncome = (monthEntries ?? [])
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const totalExpense = (monthEntries ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const closingBalance = period.openingBalance + totalIncome - totalExpense

  const { error: closeError } = await supabase
    .from('finance_periods')
    .update({
      status: 'closed',
      total_income: totalIncome,
      total_expense: totalExpense,
      closing_balance: closingBalance,
      closed_by: user?.id ?? null,
      closed_at: new Date().toISOString(),
    })
    .eq('id', period.id)

  if (closeError) return { error: 'No se pudo cerrar el periodo.' }

  const { error: lockError } = await supabase
    .from('finance_entries')
    .update({ locked: true })
    .eq('business_id', businessId)
    .gte('date', period.periodStart)
    .lte('date', period.periodEnd)

  if (lockError) return { error: 'El periodo se cerró, pero no se pudieron bloquear los movimientos.' }

  return { success: true }
}

export async function openNextFinanceMonth(
  month?: string,
  resetMode: FinanceResetMode = 'carry_over'
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No autenticado.' }

  const currentPeriod = await ensureMonthlyPeriod(supabase, businessId, month)
  if (!currentPeriod) return { error: 'Aún no hay ventas registradas para iniciar un periodo.' }
  if (currentPeriod.status !== 'closed') {
    return { error: 'Primero cierra el periodo actual.' }
  }

  const { nextMonth } = parseMonthRange(currentPeriod.month)

  const { data: existingNext } = await supabase
    .from('finance_periods')
    .select('id')
    .eq('business_id', businessId)
    .eq('period_type', 'month')
    .eq('period_start', `${nextMonth}-01`)
    .maybeSingle()

  if (existingNext) {
    return { error: 'El siguiente periodo ya existe.' }
  }

  const { startDate, endDate } = parseMonthRange(nextMonth)
  const openingBalance = resetMode === 'carry_over' ? currentPeriod.closingBalance : 0

  const insert: FinancePeriodInsert = {
    business_id: businessId,
    period_type: 'month',
    period_start: startDate,
    period_end: endDate,
    status: 'open',
    opening_balance: openingBalance,
    total_income: 0,
    total_expense: 0,
    closing_balance: openingBalance,
    reset_mode: resetMode,
  }

  const { error } = await supabase.from('finance_periods').insert(insert)
  if (error) return { error: 'No se pudo abrir el siguiente periodo.' }

  return { success: true }
}
