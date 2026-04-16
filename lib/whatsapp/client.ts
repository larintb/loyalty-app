// WhatsApp Gateway propio — https://wa.puntaje.online
// Docs: WHATSAPP_GATEWAY.md

import { normalizePhone } from '@/lib/utils/phone'

const BASE_URL = (process.env.WHATSAPP_API_URL ?? 'https://wa.puntaje.online').replace(/\/$/, '')
const API_KEY  = process.env.WHATSAPP_API_KEY

type SendTextResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

export type SendMessageResult = SendTextResult

async function waRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY ?? '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function getStatus() {
  const res = await waRequest('GET', '/api/status')
  return res.json()
}

export async function checkNumber(phone: string): Promise<{ exists: boolean; waId?: string }> {
  const res = await waRequest('GET', `/api/check-number/${encodeURIComponent(phone)}`)
  if (!res.ok) return { exists: false }
  return res.json()
}

export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendTextResult> {
  if (!API_KEY) {
    return { success: false, error: 'Falta WHATSAPP_API_KEY en variables de entorno.' }
  }

  const normalized = normalizePhone(to)
  const res = await waRequest('POST', '/api/send-text', { to: normalized, body: text })
  const data: unknown = await res.json().catch(() => ({}))

  if (res.ok) {
    const record = data as Record<string, unknown>
    return { success: true, messageId: (record.messageId as string) ?? `sent:${normalized}` }
  }

  const record = data as Record<string, unknown>
  return { success: false, error: (record.error as string) ?? `Error HTTP ${res.status}` }
}

export async function sendImageMessage(params: {
  to: string
  imageUrl: string
  caption?: string
}): Promise<SendMessageResult> {
  if (!API_KEY) {
    return { success: false, error: 'Falta WHATSAPP_API_KEY en variables de entorno.' }
  }

  const normalized = normalizePhone(params.to)
  const res = await waRequest('POST', '/api/send-image', {
    to: normalized,
    imageUrl: params.imageUrl,
    caption: params.caption,
  })
  const data: unknown = await res.json().catch(() => ({}))

  if (res.ok) {
    const record = data as Record<string, unknown>
    return { success: true, messageId: (record.messageId as string) ?? `sent:${normalized}` }
  }

  const record = data as Record<string, unknown>
  return { success: false, error: (record.error as string) ?? `Error HTTP ${res.status}` }
}

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
    timeZone: 'America/Matamoros',
  })
}
