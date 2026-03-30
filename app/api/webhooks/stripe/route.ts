/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { constructStripeEvent } from '@/lib/stripe/webhooks'
import { resolvePlanSlugFromPriceId, normalizePlanSlug, getStripeClient } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

type PlanStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'

function toIsoFromUnix(value?: number | null) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function mapStripeStatusToPlanStatus(status: string | null | undefined): PlanStatus {
  if (!status) return 'past_due'
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') {
    return 'past_due'
  }
  return 'cancelled'
}

async function findBusinessIdFromStripeRefs(admin: ReturnType<typeof createAdminClient>, refs: {
  businessId?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
}) {
  if (refs.businessId) return refs.businessId

  if (refs.stripeSubscriptionId) {
    const { data } = await (admin as any)
      .from('businesses' as any)
      .select('id')
      .eq('stripe_subscription_id', refs.stripeSubscriptionId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  if (refs.stripeCustomerId) {
    const { data } = await (admin as any)
      .from('businesses' as any)
      .select('id')
      .eq('stripe_customer_id', refs.stripeCustomerId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  return null
}

async function insertBillingEvent(admin: ReturnType<typeof createAdminClient>, input: {
  businessId: string
  eventType: string
  planFrom?: string | null
  planTo?: string | null
  amount?: number | null
  reason?: string | null
  metadata?: Record<string, unknown>
}) {
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

async function handleSubscriptionEvent(admin: ReturnType<typeof createAdminClient>, subscription: Stripe.Subscription) {
  const subscriptionAny = subscription as any
  const firstItem = subscription.items.data[0]
  const stripePriceId = firstItem?.price?.id ?? null

  const planSlug =
    (subscription.metadata?.plan_slug as string | undefined) ??
    resolvePlanSlugFromPriceId(stripePriceId)

  const businessId = await findBusinessIdFromStripeRefs(admin, {
    businessId: subscription.metadata?.business_id,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubscriptionId: subscription.id,
  })

  if (!businessId) return

  const planStatus = mapStripeStatusToPlanStatus(subscription.status)
  const completedFromOnboarding = subscription.metadata?.source === 'onboarding'

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('slug', planSlug ?? '')
    .maybeSingle()

  await (admin as any)
    .from('stripe_subscriptions')
    .upsert(
      {
        business_id: businessId,
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
        stripe_subscription_id: subscription.id,
        plan_slug: planSlug ?? 'basic',
        stripe_price_id: stripePriceId,
        status: subscription.status,
        current_period_start: toIsoFromUnix(subscriptionAny.current_period_start),
        current_period_end: toIsoFromUnix(subscriptionAny.current_period_end),
        trial_end: toIsoFromUnix(subscriptionAny.trial_end),
        canceled_at: toIsoFromUnix(subscriptionAny.canceled_at),
        metadata: {
          source: 'webhook',
          event_source: 'customer.subscription.*',
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )

  await (admin as any)
    .from('businesses' as any)
    .update({
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
      stripe_subscription_id: subscription.status === 'canceled' ? null : subscription.id,
      plan_status: planStatus,
      ...(plan?.id ? { plan_id: plan.id } : {}),
      ...(completedFromOnboarding ? { onboarding_completed: true } : {}),
    })
    .eq('id', businessId)

  const eventType = subscription.status === 'canceled' ? 'subscription_cancelled' : 'subscription_synced'

  await insertBillingEvent(admin, {
    businessId,
    eventType,
    planTo: planSlug,
    metadata: {
      stripe_subscription_id: subscription.id,
      stripe_status: subscription.status,
      stripe_price_id: stripePriceId,
    },
  })
}

async function handleInvoiceEvent(admin: ReturnType<typeof createAdminClient>, invoice: Stripe.Invoice, eventType: string) {
  const invoiceAny = invoice as any
  const businessId = await findBusinessIdFromStripeRefs(admin, {
    businessId: invoice.metadata?.business_id,
    stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : null,
    stripeSubscriptionId: typeof invoiceAny.subscription === 'string' ? invoiceAny.subscription : null,
  })

  if (!businessId) return

  await (admin as any)
    .from('stripe_invoices')
    .upsert(
      {
        business_id: businessId,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: typeof invoiceAny.subscription === 'string' ? invoiceAny.subscription : null,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        paid_at: toIsoFromUnix(invoice.status_transitions?.paid_at),
        due_date: toIsoFromUnix(invoice.due_date),
        invoice_pdf_url: invoice.invoice_pdf,
      },
      { onConflict: 'stripe_invoice_id' }
    )

  if (eventType === 'invoice.payment_failed') {
    await (admin as any)
      .from('businesses' as any)
      .update({ plan_status: 'past_due' })
      .eq('id', businessId)

    await insertBillingEvent(admin, {
      businessId,
      eventType: 'payment_failed',
      amount: invoice.amount_due,
      metadata: {
        stripe_invoice_id: invoice.id,
      },
    })
  }

  if (eventType === 'invoice.payment_succeeded') {
    await (admin as any)
      .from('businesses' as any)
      .update({ plan_status: 'active' })
      .eq('id', businessId)

    await insertBillingEvent(admin, {
      businessId,
      eventType: 'payment_succeeded',
      amount: invoice.amount_paid,
      metadata: {
        stripe_invoice_id: invoice.id,
      },
    })
  }
}

async function handleCheckoutSessionEvent(admin: ReturnType<typeof createAdminClient>, session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null

  const businessId = await findBusinessIdFromStripeRefs(admin, {
    businessId: session.metadata?.business_id,
    stripeCustomerId,
    stripeSubscriptionId,
  })

  if (!businessId) return

  // Retrieve the full subscription to get all fields
  if (!stripeSubscriptionId) return
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const subscriptionAny = subscription as any

  const firstItem = subscription.items.data[0]
  const stripePriceId = firstItem?.price?.id ?? null
  const planSlug =
    normalizePlanSlug(session.metadata?.plan_slug ?? '') ??
    normalizePlanSlug(subscription.metadata?.plan_slug ?? '') ??
    resolvePlanSlugFromPriceId(stripePriceId)

  const planStatus = mapStripeStatusToPlanStatus(subscription.status)
  const completedFromOnboarding = session.metadata?.source === 'onboarding'

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('slug', planSlug ?? '')
    .maybeSingle()

  await (admin as any)
    .from('stripe_subscriptions')
    .upsert(
      {
        business_id: businessId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan_slug: planSlug ?? 'basic',
        stripe_price_id: stripePriceId,
        status: subscription.status,
        current_period_start: toIsoFromUnix(subscriptionAny.current_period_start),
        current_period_end: toIsoFromUnix(subscriptionAny.current_period_end),
        trial_end: toIsoFromUnix(subscriptionAny.trial_end),
        canceled_at: toIsoFromUnix(subscriptionAny.canceled_at),
        metadata: {
          source: 'webhook',
          event_source: 'checkout.session.completed',
          stripe_checkout_session_id: session.id,
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
      ...(plan?.id ? { plan_id: plan.id } : {}),
      ...(completedFromOnboarding ? { onboarding_completed: true } : {}),
    })
    .eq('id', businessId)

  await insertBillingEvent(admin, {
    businessId,
    eventType: 'checkout_completed',
    planTo: planSlug,
    metadata: {
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: subscription.id,
      stripe_status: subscription.status,
    },
  })
}

async function handleChargeEvent(admin: ReturnType<typeof createAdminClient>, charge: Stripe.Charge, eventType: string) {
  const businessId = await findBusinessIdFromStripeRefs(admin, {
    businessId: charge.metadata?.business_id,
    stripeCustomerId: typeof charge.customer === 'string' ? charge.customer : null,
  })

  if (!businessId) return

  await insertBillingEvent(admin, {
    businessId,
    eventType: eventType === 'charge.succeeded' ? 'charge_succeeded' : 'charge_failed',
    amount: charge.amount,
    reason: charge.failure_message,
    metadata: {
      stripe_charge_id: charge.id,
      status: charge.status,
    },
  })
}

export async function POST(request: Request) {
  const admin = createAdminClient()

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = constructStripeEvent(rawBody, signature)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid signature' },
      { status: 401 }
    )
  }

  const { data: existing } = await (admin as any)
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing?.id) {
    return Response.json({ received: true, duplicate: true })
  }

  await (admin as any)
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_object_id: (event.data.object as any)?.id ?? null,
      payload: event as any,
      created_at: new Date().toISOString(),
    })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionEvent(admin, event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(admin, event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        await handleInvoiceEvent(admin, event.data.object as Stripe.Invoice, event.type)
        break
      case 'charge.succeeded':
      case 'charge.failed':
        await handleChargeEvent(admin, event.data.object as Stripe.Charge, event.type)
        break
      default:
        break
    }

    await (admin as any)
      .from('stripe_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('stripe_event_id', event.id)

    return Response.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing error'

    await (admin as any)
      .from('stripe_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('stripe_event_id', event.id)

    return Response.json({ received: true, processing_error: message }, { status: 200 })
  }
}

export async function GET() {
  return Response.json({ status: 'ok', provider: 'stripe' })
}
