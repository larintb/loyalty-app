import { cache } from 'react'
import { getCachedUser, getCachedBusinessOwnerData, getCachedSubscriptionPlan } from '@/lib/auth-context'
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

// Builds plan data from shared cached functions — no extra DB queries.
const fetchPlanData = cache(async () => {
  const user = await getCachedUser()
  if (!user) return null

  const [biz, plan] = await Promise.all([
    getCachedBusinessOwnerData(),
    getCachedSubscriptionPlan(),
  ])

  if (!biz) return null

  return {
    biz,
    planId: biz.plan_id,
    planSlug: plan?.slug ?? null,
    planName: plan?.name ?? null,
    maxCustomers: plan?.max_customers ?? null,
  }
})

export async function getPlanAccess(feature?: string): Promise<PlanAccess> {
  const data = await fetchPlanData()
  if (!data) return EMPTY

  const { biz, planId, planSlug, planName, maxCustomers } = data

  const now = new Date()
  const trialEnd = biz.trial_ends_at ? new Date(biz.trial_ends_at) : null
  const isTrial = biz.plan_status === 'trialing' && !!trialEnd && trialEnd > now
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
    } else if (biz.plan_status === 'active') {
      canAccess = planNormallyIncludes
    }
  } else {
    canAccess = isTrial || ['active', 'cancelling'].includes(biz.plan_status ?? '')
  }

  return {
    planId,
    planSlug,
    planName,
    planStatus: biz.plan_status ?? null,
    trialEndsAt: biz.trial_ends_at ?? null,
    isTrial,
    daysLeft,
    maxCustomers,
    canAccess,
    showBanner,
    requiredPlanSlug,
    requiredPlanName,
  }
}
