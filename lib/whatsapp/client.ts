// Meta WhatsApp Cloud API
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
// Tier gratuito: 1,000 conversaciones/mes con usuarios que te escriben primero
// Conversaciones iniciadas por negocio (tickets): ~$0.05 USD c/u

import { normalizePhone } from '@/lib/utils/phone'

const META_API_VERSION = 'v19.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

const PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN!

type SendTextResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

// Enviar mensaje de texto simple
export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendTextResult> {
  // Normalizar número: quitar +, espacios, guiones → solo dígitos con código de país
  const normalized = normalizePhone(to)

  const res = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalized,
      type: 'text',
      text: { body: text },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('[WhatsApp] Error:', data)
    return {
      success: false,
      error: data?.error?.message ?? 'Error desconocido de WhatsApp API',
    }
  }

  return { success: true, messageId: data.messages?.[0]?.id }
}

// Enviar ticket como mensaje de texto formateado
// (usar template aprobado por Meta en producción para mensajes iniciados por negocio)
export async function sendTicketMessage(params: {
  to: string
  businessName: string
  ticketNumber: string
  customerName: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  discountByPoints: number
  total: number
  pointsEarned: number
  pointsBalance: number
}): Promise<SendTextResult> {
  const {
    to,
    businessName,
    ticketNumber,
    customerName,
    items,
    subtotal,
    discountByPoints,
    total,
    pointsEarned,
    pointsBalance,
  } = params

  const itemsText = items
    .map((i) => `  • ${i.quantity}x ${i.name}  $${i.price.toFixed(2)}`)
    .join('\n')

  const discountLine =
    discountByPoints > 0
      ? `\n💳 Descuento puntos:  -$${discountByPoints.toFixed(2)}`
      : ''

  const message =
    `🧾 *${businessName}*\n` +
    `Ticket #${ticketNumber}\n` +
    `📅 ${formatDate(new Date())}\n\n` +
    `Hola ${customerName} 👋\n\n` +
    `*Tu compra:*\n${itemsText}\n\n` +
    `Subtotal:        $${subtotal.toFixed(2)}${discountLine}\n` +
    `*TOTAL:          $${total.toFixed(2)}*\n\n` +
    `⭐ Puntos ganados: +${pointsEarned}\n` +
    `🏆 Tu saldo:       ${pointsBalance} pts\n\n` +
    `¡Gracias por tu preferencia! 🙌`

  return sendTextMessage(to, message)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
