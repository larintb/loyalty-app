/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { planIncludes, PLAN_NAMES, FEATURE_MIN_PLAN } from './plans'

export type PlanAccess = {
  planId: string | null
  planSlug: string | null
  planName: string | null
  planStatus: string | null
  trialEndsAt: string | null
  isTrial: boolean
  daysLeft: number
  maxCustomers: number | null
  // feature-specific (only populated when feature is passed)
  canAccess: boolean
  /** true when canAccess=true comes solely from trial (plan wouldn't normally include it) */
  showBanner: boolean
  requiredPlanSlug: string | null
  requiredPlanName: string | null
}

const EMPTY: PlanAccess = {
  planId: null, planSlug: null, planName: null, planStatus: null,
  trialEndsAt: null, isTrial: false, daysLeft: 0, maxCustomers: null,
  canAccess: false, showBanner: false, requiredPlanSlug: null, requiredPlanName: null,
}

export async function getPlanAccess(feature?: string): Promise<PlanAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const { data: business } = await supabase
    .from('businesses')
    .select('plan_status, trial_ends_at, plan_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) return EMPTY

  let planSlug: string | null = null
  let planName: string | null = null
  let maxCustomers: number | null = null
  const planId: string | null = (business as any).plan_id ?? null

  if (planId) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('slug, name, max_customers')
      .eq('id', planId)
      .maybeSingle()
    planSlug = (plan as any)?.slug ?? null
    planName = (plan as any)?.name ?? null
    maxCustomers = (plan as any)?.max_customers ?? null
  }

  const now = new Date()
  const trialEnd = (business as any).trial_ends_at
    ? new Date((business as any).trial_ends_at)
    : null
  const isTrial =
    (business as any).plan_status === 'trialing' && !!trialEnd && trialEnd > now
  const daysLeft = isTrial && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  let canAccess = false
  let showBanner = false
  let requiredPlanSlug: string | null = null
  let requiredPlanName: string | null = null

  if (feature) {
    const minPlan = FEATURE_MIN_PLAN[feature]
    requiredPlanSlug = minPlan ?? null
    requiredPlanName = minPlan ? (PLAN_NAMES[minPlan] ?? null) : null

    const planNormallyIncludes = planIncludes(planSlug, feature)

    if (isTrial) {
      canAccess = true
      showBanner = !planNormallyIncludes
    } else if ((business as any).plan_status === 'active') {
      canAccess = planNormallyIncludes
    }
  } else {
    canAccess = isTrial || (business as any).plan_status === 'active'
  }

  return {
    planId,
    planSlug,
    planName,
    planStatus: (business as any).plan_status ?? null,
    trialEndsAt: (business as any).trial_ends_at ?? null,
    isTrial,
    daysLeft,
    maxCustomers,
    canAccess,
    showBanner,
    requiredPlanSlug,
    requiredPlanName,
  }
}
