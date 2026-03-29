// Whapi Cloud API
// Docs: https://whapi.cloud/

import { normalizePhone } from '@/lib/utils/phone'

const BASE_URL = (process.env.WHAPI_API_URL ?? 'https://gate.whapi.cloud').replace(/\/$/, '')
const ACCESS_TOKEN = process.env.WHAPI_TOKEN

type SendTextResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

export type SendMessageResult = SendTextResult

async function sendWhapiMessage(
  to: string,
  endpoint: 'text' | 'image',
  payload: Record<string, unknown>
): Promise<SendMessageResult> {
  if (!ACCESS_TOKEN) {
    return {
      success: false,
      error: 'Falta WHAPI_TOKEN en variables de entorno.',
    }
  }

  const normalized = normalizePhone(to)

  // Los números móviles mexicanos en WhatsApp llevan un "1" extra después del
  // código de país: 52XXXXXXXXXX → 521XXXXXXXXXX. Probamos ambos formatos.
  const mxAlternative =
    normalized.startsWith('52') && normalized.length === 12
      ? `521${normalized.slice(2)}`
      : null

  const candidates = mxAlternative
    ? [
        `${mxAlternative}@s.whatsapp.net`,
        `${normalized}@s.whatsapp.net`,
        mxAlternative,
        normalized,
      ]
    : [`${normalized}@s.whatsapp.net`, normalized]

  const recipients = candidates
  let lastError = 'Error desconocido de Whapi'

  for (const recipient of recipients) {
    const res = await fetch(`${BASE_URL}/messages/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipient,
        ...payload,
      }),
    })

    const data: unknown = await res.json().catch(() => ({}))

    if (res.ok) {
      return {
        success: true,
        messageId: getWhapiMessageId(data) ?? `sent:${recipient}`,
      }
    }

    const whapiError = getWhapiError(data)
    lastError = whapiError ?? `Error HTTP ${res.status} de Whapi`
    console.error('[Whapi] Error:', data)
  }

  return { success: false, error: lastError }
}

// Enviar mensaje de texto simple
export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendTextResult> {
  return sendWhapiMessage(to, 'text', { body: text })
}

// Enviar imagen con caption opcional
export async function sendImageMessage(params: {
  to: string
  imageUrl: string
  caption?: string
}): Promise<SendMessageResult> {
  return sendWhapiMessage(params.to, 'image', {
    media: params.imageUrl,
    caption: params.caption ?? '',
  })
}

// Enviar ticket como mensaje de texto formateado
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

function getWhapiMessageId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  if (typeof record.id === 'string') return record.id

  const message = record.message
  if (message && typeof message === 'object') {
    const messageId = (message as Record<string, unknown>).id
    if (typeof messageId === 'string') return messageId
  }

  return null
}

function getWhapiError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  const directMessage = record.message
  if (typeof directMessage === 'string') return directMessage

  const errorObj = record.error
  if (errorObj && typeof errorObj === 'object') {
    const errorMessage = (errorObj as Record<string, unknown>).message
    if (typeof errorMessage === 'string') return errorMessage
  }

  return null
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
