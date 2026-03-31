import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * React cache() deduplicates within a single server render pass.
 * Layout, page, and all server actions called during a page render share one result.
 * This eliminates duplicate getUser/businesses/plans queries on every request.
 */

export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
})

export type BusinessOwnerData = {
  id: string
  name: string
  plan_status: string | null
  logo_url: string | null
  plan_id: string | null
  trial_ends_at: string | null
  current_period_end: string | null
}

// Fetches the full business record for the authenticated owner.
// Returns null if the user is not a business owner (e.g. staff member).
export const getCachedBusinessOwnerData = cache(async (): Promise<BusinessOwnerData | null> => {
  const user = await getCachedUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('id, name, plan_status, logo_url, plan_id, trial_ends_at, current_period_end')
    .eq('owner_id', user.id)
    .maybeSingle()

  return (data as BusinessOwnerData | null) ?? null
})

export type StaffRecord = {
  business_id: string
}

export const getCachedStaffRecord = cache(async (): Promise<StaffRecord | null> => {
  const user = await getCachedUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return (data as StaffRecord | null) ?? null
})

export type SubscriptionPlan = {
  slug: string
  name: string
  max_customers: number | null
}

// Fetches the subscription plan for the owner's business.
export const getCachedSubscriptionPlan = cache(async (): Promise<SubscriptionPlan | null> => {
  const biz = await getCachedBusinessOwnerData()
  if (!biz?.plan_id) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('subscription_plans')
    .select('slug, name, max_customers')
    .eq('id', biz.plan_id)
    .maybeSingle()

  return (data as SubscriptionPlan | null) ?? null
})

// Resolves the operational business ID for any user (owner or staff).
// Uses cached owner data + staff record so the DB is only hit once per request.
export const getCachedBusinessId = cache(async (): Promise<string | null> => {
  const [ownerBiz, staff] = await Promise.all([
    getCachedBusinessOwnerData(),
    getCachedStaffRecord(),
  ])
  return ownerBiz?.id ?? staff?.business_id ?? null
})
