export const PLAN_ORDER = ['starter', 'basic', 'growth', 'unlimited'] as const
export type PlanSlug = (typeof PLAN_ORDER)[number]

export const PLAN_NAMES: Record<string, string> = {
  starter: 'Legacy',
  basic: 'Inicial',
  growth: 'Pro',
  unlimited: 'Premium',
}

export const FEATURE_LABELS: Record<string, string> = {
  campaigns: 'Campañas WhatsApp',
  finance: 'Finanzas',
  reports: 'Reportes',
}

/** Minimum plan slug required to access a feature */
export const FEATURE_MIN_PLAN: Record<string, PlanSlug> = {
  campaigns: 'growth',
  finance: 'growth',
  reports: 'growth',
}

export const PLAN_DOT_COLOR: Record<string, string> = {
  starter: 'bg-slate-400',
  basic: 'bg-emerald-500',
  growth: 'bg-indigo-500',
  unlimited: 'bg-amber-500',
}

export function planRank(slug: string | null): number {
  if (!slug) return -1
  return PLAN_ORDER.indexOf(slug as PlanSlug)
}

export function planIncludes(planSlug: string | null, feature: string): boolean {
  const minPlan = FEATURE_MIN_PLAN[feature]
  if (!minPlan) return true
  return planRank(planSlug) >= planRank(minPlan)
}
