'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedBusinessId } from '@/lib/auth-context'

// ─── Ventas diarias (últimos N días) ─────────────────────────────────────────

export type DailySale = {
  date: string       // 'YYYY-MM-DD'
  total: number
  count: number
}

export async function getDailySales(days = 30): Promise<DailySale[]> {
  const businessId = await getCachedBusinessId()
  if (!businessId) return []

  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('transactions')
    .select('total, created_at')
    .eq('business_id', businessId)
    .eq('type', 'sale')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  if (!data) return []

  // Agrupar por día en JS
  const map = new Map<string, { total: number; count: number }>()
  for (const tx of data) {
    const day = tx.created_at.slice(0, 10)
    const prev = map.get(day) ?? { total: 0, count: 0 }
    map.set(day, { total: prev.total + Number(tx.total), count: prev.count + 1 })
  }

  // Rellenar días sin ventas
  const result: DailySale[] = []
  const cursor = new Date(since)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10)
    const entry = map.get(key) ?? { total: 0, count: 0 }
    result.push({ date: key, total: entry.total, count: entry.count })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

// ─── Top clientes por gasto ───────────────────────────────────────────────────

export type TopCustomer = {
  id: string
  name: string
  phone: string
  total_points: number
  lifetime_spend: number
  visit_count: number
  avg_ticket: number
  last_visit_at: string | null
}

export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const businessId = await getCachedBusinessId()
  if (!businessId) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, total_points, lifetime_spend, visit_count, last_visit_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('lifetime_spend', { ascending: false })
    .limit(limit)

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    total_points: c.total_points,
    lifetime_spend: Number(c.lifetime_spend),
    visit_count: c.visit_count,
    avg_ticket:
      c.visit_count > 0
        ? Math.round(Number(c.lifetime_spend) / c.visit_count)
        : 0,
    last_visit_at: c.last_visit_at,
  }))
}

// ─── Clientes en riesgo de abandono ──────────────────────────────────────────

export type ChurnCustomer = {
  id: string
  name: string
  phone: string
  days_inactive: number
  risk: 'high' | 'medium'
  total_points: number
  visit_count: number
  last_visit_at: string
}

export async function getChurnRisk(): Promise<ChurnCustomer[]> {
  const businessId = await getCachedBusinessId()
  if (!businessId) return []

  const supabase = await createClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, total_points, visit_count, last_visit_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('visit_count', 2)                          // solo clientes que han vuelto
    .lt('last_visit_at', thirtyDaysAgo.toISOString())
    .order('last_visit_at', { ascending: true })
    .limit(20)

  const now = Date.now()
  return (data ?? [])
    .filter((c) => c.last_visit_at)
    .map((c) => {
      const daysInactive = Math.floor(
        (now - new Date(c.last_visit_at!).getTime()) / 86_400_000
      )
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        days_inactive: daysInactive,
        risk: daysInactive >= 60 ? 'high' : 'medium',
        total_points: c.total_points,
        visit_count: c.visit_count,
        last_visit_at: c.last_visit_at!,
      }
    })
}

// ─── Métricas del periodo ─────────────────────────────────────────────────────

export type PeriodMetrics = {
  totalSales: number
  totalTransactions: number
  avgTicket: number
  newCustomers: number
  returningRate: number   // % de ventas con cliente identificado
}

export async function getPeriodMetrics(days = 30): Promise<PeriodMetrics> {
  const businessId = await getCachedBusinessId()
  if (!businessId) return { totalSales: 0, totalTransactions: 0, avgTicket: 0, newCustomers: 0, returningRate: 0 }

  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  const [{ data: txs }, { count: newCustomers }] = await Promise.all([
    supabase
      .from('transactions')
      .select('total, customer_id')
      .eq('business_id', businessId)
      .eq('type', 'sale')
      .gte('created_at', since.toISOString()),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', since.toISOString()),
  ])

  if (!txs?.length) return { totalSales: 0, totalTransactions: 0, avgTicket: 0, newCustomers: newCustomers ?? 0, returningRate: 0 }

  const totalSales = txs.reduce((s, t) => s + Number(t.total), 0)
  const withCustomer = txs.filter((t) => t.customer_id).length

  return {
    totalSales,
    totalTransactions: txs.length,
    avgTicket: Math.round(totalSales / txs.length),
    newCustomers: newCustomers ?? 0,
    returningRate: Math.round((withCustomer / txs.length) * 100),
  }
}
