'use server'

import { createClient } from '@/lib/supabase/server'
import type { FinanceEntryInsert } from '@/types/database'

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
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

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

export async function getFinanceEntries(month?: string): Promise<FinanceEntryView[]> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return []

  const now = new Date()
  const targetMonth =
    month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, mon] = targetMonth.split('-').map(Number)
  const startDate = `${targetMonth}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`

  const { data } = await supabase
    .from('finance_entries')
    .select('id, type, category, amount, description, date, created_at')
    .eq('business_id', businessId)
    .gte('date', startDate)
    .lte('date', endDate)
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

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('business_id', businessId)
    .maybeSingle()

  const insert: FinanceEntryInsert = {
    business_id: businessId,
    staff_id: staff?.id ?? null,
    type: payload.type,
    category: payload.category,
    amount: payload.amount,
    description: payload.description || null,
    date: payload.date ?? new Date().toISOString().split('T')[0],
  }

  const { error } = await supabase.from('finance_entries').insert(insert)
  if (error) return { error: 'Error al guardar la entrada.' }

  return { success: true }
}
