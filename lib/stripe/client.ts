import 'server-only'
import Stripe from 'stripe'

export type InternalPlanSlug = 'basic' | 'growth' | 'unlimited'

type PlanAlias = 'starter' | 'pro' | 'premium' | InternalPlanSlug

const PLAN_ALIAS_MAP: Record<PlanAlias, InternalPlanSlug> = {
  starter: 'basic',
  pro: 'growth',
  premium: 'unlimited',
  basic: 'basic',
  growth: 'growth',
  unlimited: 'unlimited',
}

export function normalizePlanSlug(planId: string): InternalPlanSlug | null {
  const key = planId.trim().toLowerCase() as PlanAlias
  return PLAN_ALIAS_MAP[key] ?? null
}

export const STRIPE_PRICE_IDS: Record<InternalPlanSlug, string> = {
  basic: process.env.NEXT_PUBLIC_STRIPE_PLAN_STARTER_PRICE_ID ?? '',
  growth: process.env.NEXT_PUBLIC_STRIPE_PLAN_PRO_PRICE_ID ?? '',
  unlimited: process.env.NEXT_PUBLIC_STRIPE_PLAN_PREMIUM_PRICE_ID ?? '',
}

export const STRIPE_PLAN_NAMES: Record<InternalPlanSlug, string> = {
  basic: 'Inicial',
  growth: 'Pro',
  unlimited: 'Premium',
}

export const STRIPE_PLAN_PRICES_MXN: Record<InternalPlanSlug, number> = {
  basic: 695,
  growth: 1159,
  unlimited: 1971,
}

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Falta STRIPE_SECRET_KEY en variables de entorno.')
  }
  return key
}

export function getStripeClient() {
  return new Stripe(getStripeSecretKey())
}

export function getStripePriceId(planSlug: InternalPlanSlug) {
  const priceId = STRIPE_PRICE_IDS[planSlug]
  if (!priceId || !priceId.startsWith('price_')) {
    throw new Error(`Price ID inválido para plan ${planSlug}. Revisa .env.local`) 
  }
  return priceId
}

export function resolvePlanSlugFromPriceId(priceId: string | null | undefined): InternalPlanSlug | null {
  if (!priceId) return null
  const found = (Object.entries(STRIPE_PRICE_IDS) as Array<[InternalPlanSlug, string]>)
    .find(([, value]) => value === priceId)
  return found?.[0] ?? null
}
