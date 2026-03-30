import 'server-only'
import Stripe from 'stripe'
import { getStripeClient } from './client'

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('Falta STRIPE_WEBHOOK_SECRET en variables de entorno.')
  }
  return secret
}

export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) {
    throw new Error('Header stripe-signature ausente.')
  }

  const stripe = getStripeClient()
  const webhookSecret = getStripeWebhookSecret()

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}
