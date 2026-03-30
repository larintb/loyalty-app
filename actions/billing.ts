'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getStripeClient,
  normalizePlanSlug,
  getStripePriceId,
  resolvePlanSlugFromPriceId,
  STRIPE_PLAN_NAMES,
  type InternalPlanSlug,
} from '@/lib/stripe/client'

type BillingResult = { success: true; message?: string; [key: string]: unknown } | { success: false; error: string }

type BusinessContext = {
  userId: string
  userEmail: string | null
  businessId: string
  businessName: string
  businessEmail: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  role: 'owner' | 'admin' | 'cashier'
}

function toIsoFromUnix(value?: number | null) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function mapStripeStatusToPlanStatus(status: string | null | undefined): 'trialing' | 'active' | 'past_due' | 'cancelled' {
  if (!status) return 'past_due'
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') {
    return 'past_due'
  }
  return 'cancelled'
}

async function getBusinessContext(requireWrite = false): Promise<BusinessContext | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ownerBusiness } = await (supabase as any)
    .from('businesses' as any)
    .select('id, name, email, stripe_customer_id, stripe_subscription_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ownerBusiness) {
    return {
      userId: user.id,
      userEmail: user.email ?? null,
      businessId: ownerBusiness.id,
      businessName: ownerBusiness.name,
      businessEmail: ownerBusiness.email,
      stripeCustomerId: ownerBusiness.stripe_customer_id,
      stripeSubscriptionId: ownerBusiness.stripe_subscription_id,
      role: 'owner',
    }
  }

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff?.business_id) return null

  if (requireWrite && !['owner', 'admin'].includes(staff.role)) {
    return null
  }

  const { data: business } = await (supabase as any)
    .from('businesses' as any)
    .select('id, name, email, stripe_customer_id, stripe_subscription_id')
    .eq('id', staff.business_id)
    .maybeSingle()

  if (!business) return null

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    businessId: business.id,
    businessName: business.name,
    businessEmail: business.email,
    stripeCustomerId: business.stripe_customer_id,
    stripeSubscriptionId: business.stripe_subscription_id,
    role: staff.role,
  }
}

async function upsertBillingEvent(input: {
  businessId: string
  eventType: string
  planFrom?: string | null
  planTo?: string | null
  amount?: number | null
  reason?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  await (admin as any).from('billing_events').insert({
    business_id: input.businessId,
    event_type: input.eventType,
    plan_from: input.planFrom ?? null,
    plan_to: input.planTo ?? null,
    amount: input.amount ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  })
}

async function ensureStripeCustomer(context: BusinessContext): Promise<string> {
  const stripe = getStripeClient()
  const admin = createAdminClient()

  if (context.stripeCustomerId) return context.stripeCustomerId

  const customer = await stripe.customers.create({
    name: context.businessName,
    email: context.businessEmail ?? context.userEmail ?? undefined,
    metadata: {
      business_id: context.businessId,
      business_name: context.businessName,
    },
  })

  await (admin as any)
    .from('businesses' as any)
    .update({ stripe_customer_id: customer.id })
    .eq('id', context.businessId)

  await (admin as any)
    .from('stripe_customers')
    .upsert(
      {
        business_id: context.businessId,
        stripe_customer_id: customer.id,
        email: context.businessEmail ?? context.userEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )

  return customer.id
}

async function resolvePlanRowId(planSlug: InternalPlanSlug) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('slug', planSlug)
    .maybeSingle()
  return data?.id ?? null
}

async function resolvePlanSlugFromInput(planInput: string): Promise<InternalPlanSlug | null> {
  const normalized = normalizePlanSlug(planInput)
  if (normalized) return normalized

  const admin = createAdminClient()
  const { data } = await admin
    .from('subscription_plans')
    .select('slug')
    .eq('id', planInput)
    .maybeSingle()

  if (!data?.slug) return null
  return normalizePlanSlug(data.slug)
}

export async function createCheckoutSession(
  planInput: string,
  options?: { withTrial?: boolean; source?: 'onboarding' | 'settings' | 'other' }
): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  const planSlug = await resolvePlanSlugFromInput(planInput)
  if (!planSlug) {
    return { success: false, error: 'Plan inválido para checkout.' }
  }

  try {
    const stripe = getStripeClient()
    const stripeCustomerId = await ensureStripeCustomer(context)
    const stripePriceId = getStripePriceId(planSlug)
    const requestHeaders = await headers()
    const origin =
      requestHeaders.get('origin') ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'
    const source = options?.source ?? 'settings'
    const successPath = source === 'onboarding'
      ? '/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}'
      : '/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}'
    const cancelPath = source === 'onboarding'
      ? '/onboarding?checkout=cancelled'
      : '/settings/billing?checkout=cancelled'

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        business_id: context.businessId,
        plan_slug: planSlug,
        source,
      },
    }

    if (options?.withTrial) {
      // Verificar en DB y en Stripe que no haya suscripción previa para evitar race conditions
      const adminCheck = createAdminClient()
      const { data: existingSub } = await (adminCheck as any)
        .from('stripe_subscriptions')
        .select('status')
        .eq('business_id', context.businessId)
        .maybeSingle()

      const dbHasSub = existingSub && ['trialing', 'active', 'past_due'].includes(existingSub.status)

      // Segunda verificación directa en Stripe para cubrir el caso de race condition
      // donde la DB aún no fue actualizada pero Stripe ya tiene la suscripción
      let stripeHasSub = false
      if (!dbHasSub && stripeCustomerId) {
        const stripeSubs = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'all',
          limit: 5,
        })
        stripeHasSub = stripeSubs.data.some((s) =>
          ['trialing', 'active', 'past_due'].includes(s.status)
        )
      }

      if (!dbHasSub && !stripeHasSub) {
        subscriptionData.trial_period_days = 7
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      locale: 'es-419',
      allow_promotion_codes: true,
      metadata: {
        business_id: context.businessId,
        plan_slug: planSlug,
        source,
      },
      subscription_data: subscriptionData,
    })

    if (!session.url) {
      return { success: false, error: 'No se pudo crear la sesión de pago.' }
    }

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'checkout_session_created',
      planTo: planSlug,
      metadata: {
        stripe_session_id: session.id,
        source,
        with_trial: Boolean(options?.withTrial),
      },
    })

    revalidatePath('/settings/billing')

    return {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      planSlug,
    }
  } catch (error) {
    console.error('[createCheckoutSession]', error)
    return { success: false, error: 'No se pudo iniciar el checkout. Intenta de nuevo.' }
  }
}

export async function syncCheckoutSession(sessionId: string): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return { success: false, error: 'Session de checkout inválida.' }
  }

  try {
    const stripe = getStripeClient()
    const admin = createAdminClient()

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const metadataBusinessId = checkoutSession.metadata?.business_id ?? null
    if (metadataBusinessId && metadataBusinessId !== context.businessId) {
      return { success: false, error: 'La sesión no corresponde a este negocio.' }
    }

    const stripeCustomerId =
      typeof checkoutSession.customer === 'string'
        ? checkoutSession.customer
        : context.stripeCustomerId

    const subscriptionRef = checkoutSession.subscription
    const subscription =
      typeof subscriptionRef === 'string'
        ? await stripe.subscriptions.retrieve(subscriptionRef)
        : subscriptionRef

    if (!subscription) {
      return { success: false, error: 'Stripe no devolvió una suscripción para esta sesión.' }
    }

    const firstItem = subscription.items.data[0]
    const stripePriceId = firstItem?.price?.id ?? null
    const planSlug =
      normalizePlanSlug(subscription.metadata?.plan_slug ?? '') ??
      normalizePlanSlug(checkoutSession.metadata?.plan_slug ?? '') ??
      resolvePlanSlugFromPriceId(stripePriceId)

    if (!planSlug) {
      return { success: false, error: 'No se pudo resolver el plan de la suscripción.' }
    }

    const subscriptionAny = subscription as any
    const planStatus = mapStripeStatusToPlanStatus(subscription.status)
    const planRowId = await resolvePlanRowId(planSlug)
    const source =
      subscription.metadata?.source ??
      checkoutSession.metadata?.source ??
      null
    const completedFromOnboarding = source === 'onboarding'

    await (admin as any)
      .from('stripe_subscriptions')
      .upsert(
        {
          business_id: context.businessId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          plan_slug: planSlug,
          stripe_price_id: stripePriceId,
          status: subscription.status,
          current_period_start: toIsoFromUnix(subscriptionAny.current_period_start),
          current_period_end: toIsoFromUnix(subscriptionAny.current_period_end),
          trial_end: toIsoFromUnix(subscriptionAny.trial_end),
          canceled_at: toIsoFromUnix(subscriptionAny.canceled_at),
          metadata: {
            source: 'syncCheckoutSession',
            stripe_checkout_session_id: checkoutSession.id,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      )

    await (admin as any)
      .from('businesses' as any)
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan_status: planStatus,
        ...(planRowId ? { plan_id: planRowId } : {}),
        ...(completedFromOnboarding ? { onboarding_completed: true } : {}),
      })
      .eq('id', context.businessId)

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'checkout_session_synced',
      planTo: planSlug,
      metadata: {
        stripe_checkout_session_id: checkoutSession.id,
        stripe_subscription_id: subscription.id,
      },
    })

    return {
      success: true,
      sessionId: checkoutSession.id,
      stripeSubscriptionId: subscription.id,
      planSlug,
      status: subscription.status,
    }
  } catch {
    return {
      success: false,
      error: 'No se pudo sincronizar la sesión de checkout.',
    }
  }
}

export async function createStripeCustomer(): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  try {
    const stripeCustomerId = await ensureStripeCustomer(context)
    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'stripe_customer_created',
      metadata: { stripe_customer_id: stripeCustomerId },
    })

    return { success: true, stripeCustomerId }
  } catch {
    return {
      success: false,
      error: 'No se pudo crear el cliente en Stripe.',
    }
  }
}

export async function createSubscription(planId: string, paymentMethodId: string): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  const planSlug = normalizePlanSlug(planId)
  if (!planSlug) {
    return { success: false, error: 'Plan inválido. Usa Inicial, Pro o Premium.' }
  }

  if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
    return { success: false, error: 'Método de pago inválido.' }
  }

  const stripe = getStripeClient()
  const admin = createAdminClient()

  try {
    const stripeCustomerId = await ensureStripeCustomer(context)
    const stripePriceId = getStripePriceId(planSlug)

    await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripePriceId }],
      trial_period_days: 7,
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      metadata: {
        business_id: context.businessId,
        plan_slug: planSlug,
      },
      expand: ['latest_invoice.payment_intent'],
    })

    const subscriptionAny = subscription as any
    const planStatus = mapStripeStatusToPlanStatus(subscription.status)
    const planRowId = await resolvePlanRowId(planSlug)

    await (admin as any)
      .from('stripe_subscriptions')
      .upsert(
        {
          business_id: context.businessId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          plan_slug: planSlug,
          stripe_price_id: stripePriceId,
          status: subscription.status,
          current_period_start: toIsoFromUnix(subscriptionAny.current_period_start),
          current_period_end: toIsoFromUnix(subscriptionAny.current_period_end),
          trial_end: toIsoFromUnix(subscriptionAny.trial_end),
          canceled_at: toIsoFromUnix(subscriptionAny.canceled_at),
          metadata: {
            source: 'createSubscription',
            default_payment_method: paymentMethodId,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      )

    await (admin as any)
      .from('businesses' as any)
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan_status: planStatus,
        ...(planRowId ? { plan_id: planRowId } : {}),
      })
      .eq('id', context.businessId)

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'subscription_created',
      planTo: planSlug,
      metadata: {
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
      },
    })

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent = ((latestInvoice as any)?.payment_intent as Stripe.PaymentIntent | null) ?? null

    revalidatePath('/settings')

    return {
      success: true,
      message: `Suscripción ${STRIPE_PLAN_NAMES[planSlug]} creada correctamente.`,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      planSlug,
      clientSecret: paymentIntent?.client_secret ?? null,
    }
  } catch {
    return {
      success: false,
      error: 'No se pudo crear la suscripción.',
    }
  }
}

export async function updateSubscription(newPlanId: string): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  const newPlanSlug = normalizePlanSlug(newPlanId)
  if (!newPlanSlug) {
    return { success: false, error: 'Plan inválido para actualización.' }
  }

  const admin = createAdminClient()
  const stripe = getStripeClient()

  const { data: subRow } = await (admin as any)
    .from('stripe_subscriptions')
    .select('stripe_subscription_id, plan_slug')
    .eq('business_id', context.businessId)
    .maybeSingle()

  const stripeSubscriptionId =
    (subRow as any)?.stripe_subscription_id ?? context.stripeSubscriptionId

  if (!stripeSubscriptionId) {
    return { success: false, error: 'No hay suscripción activa para este negocio.' }
  }

  try {
    const existing = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    const item = existing.items.data[0]
    if (!item) return { success: false, error: 'Suscripción inválida en Stripe.' }

    const newPriceId = getStripePriceId(newPlanSlug)

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: item.id, price: newPriceId }],
      metadata: {
        ...(existing.metadata ?? {}),
        business_id: context.businessId,
        plan_slug: newPlanSlug,
      },
      proration_behavior: 'create_prorations',
    })

    const updatedAny = updated as any
    const planStatus = mapStripeStatusToPlanStatus(updated.status)
    const planRowId = await resolvePlanRowId(newPlanSlug)
    const previousPlanSlug = (subRow as any)?.plan_slug ?? resolvePlanSlugFromPriceId(item.price?.id ?? null)

    await (admin as any)
      .from('stripe_subscriptions')
      .update({
        plan_slug: newPlanSlug,
        stripe_price_id: newPriceId,
        status: updated.status,
        current_period_start: toIsoFromUnix(updatedAny.current_period_start),
        current_period_end: toIsoFromUnix(updatedAny.current_period_end),
        trial_end: toIsoFromUnix(updatedAny.trial_end),
        canceled_at: toIsoFromUnix(updatedAny.canceled_at),
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', context.businessId)

    await (admin as any)
      .from('businesses' as any)
      .update({
        plan_status: planStatus,
        ...(planRowId ? { plan_id: planRowId } : {}),
      })
      .eq('id', context.businessId)

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'plan_updated',
      planFrom: previousPlanSlug,
      planTo: newPlanSlug,
      metadata: { stripe_subscription_id: updated.id },
    })

    revalidatePath('/settings')

    return {
      success: true,
      message: `Plan actualizado a ${STRIPE_PLAN_NAMES[newPlanSlug]}.`,
      stripeSubscriptionId: updated.id,
      status: updated.status,
      planSlug: newPlanSlug,
    }
  } catch {
    return {
      success: false,
      error: 'No se pudo actualizar la suscripción.',
    }
  }
}

export async function cancelSubscription(reason?: string): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  const admin = createAdminClient()
  const stripe = getStripeClient()

  const { data: subRow } = await (admin as any)
    .from('stripe_subscriptions')
    .select('stripe_subscription_id, plan_slug')
    .eq('business_id', context.businessId)
    .maybeSingle()

  const stripeSubscriptionId =
    (subRow as any)?.stripe_subscription_id ?? context.stripeSubscriptionId

  if (!stripeSubscriptionId) {
    return { success: false, error: 'No hay suscripción activa para cancelar.' }
  }

  try {
    const cancelled = await stripe.subscriptions.cancel(stripeSubscriptionId)
    const cancelledAny = cancelled as any

    await (admin as any)
      .from('stripe_subscriptions')
      .update({
        status: cancelled.status,
        canceled_at: toIsoFromUnix(cancelledAny.canceled_at) ?? new Date().toISOString(),
        cancel_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', context.businessId)

    await (admin as any)
      .from('businesses' as any)
      .update({
        plan_status: 'cancelled',
        stripe_subscription_id: null,
      })
      .eq('id', context.businessId)

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'subscription_cancelled',
      planFrom: (subRow as any)?.plan_slug ?? null,
      reason: reason ?? null,
      metadata: { stripe_subscription_id: stripeSubscriptionId },
    })

    revalidatePath('/settings')

    return {
      success: true,
      message: 'Suscripción cancelada correctamente.',
      stripeSubscriptionId,
    }
  } catch {
    return {
      success: false,
      error: 'No se pudo cancelar la suscripción.',
    }
  }
}

export async function getActiveSubscription(): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autenticado.' }

  const admin = createAdminClient()

  const { data: subRow, error } = await (admin as any)
    .from('stripe_subscriptions')
    .select('*')
    .eq('business_id', context.businessId)
    .maybeSingle()

  if (error) return { success: false, error: 'No se pudo cargar la suscripción.' }

  if (!subRow) {
    return { success: true, subscription: null }
  }

  return {
    success: true,
    subscription: subRow,
  }
}

export async function getInvoices(limit = 20): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autenticado.' }

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const admin = createAdminClient()

  const { data, error } = await (admin as any)
    .from('stripe_invoices')
    .select('*')
    .eq('business_id', context.businessId)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) return { success: false, error: 'No se pudo cargar el historial de facturas.' }

  return { success: true, invoices: data ?? [] }
}

export async function updatePaymentMethod(paymentMethodId: string): Promise<BillingResult> {
  const context = await getBusinessContext(true)
  if (!context) return { success: false, error: 'No autorizado para facturación.' }

  if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
    return { success: false, error: 'Método de pago inválido.' }
  }

  try {
    const stripe = getStripeClient()
    const stripeCustomerId = await ensureStripeCustomer(context)

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    })

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    await upsertBillingEvent({
      businessId: context.businessId,
      eventType: 'payment_method_updated',
      metadata: {
        stripe_customer_id: stripeCustomerId,
        payment_method_id: paymentMethodId,
      },
    })

    revalidatePath('/settings')

    return { success: true, message: 'Método de pago actualizado.' }
  } catch {
    return {
      success: false,
      error: 'No se pudo actualizar el método de pago.',
    }
  }
}
