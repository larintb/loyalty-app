// Webhook para eventos entrantes del WhatsApp Gateway propio.
// Verifica la firma HMAC-SHA256 del header X-Webhook-Signature.

import { createHmac, timingSafeEqual } from 'crypto'

export async function GET() {
  return Response.json({ status: 'ok', provider: 'whatsapp-gateway' })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signatureHeader = request.headers.get('x-webhook-signature') ?? ''
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET

  if (secret) {
    const expected =
      'sha256=' +
      createHmac('sha256', secret).update(rawBody).digest('hex')

    const isValid =
      signatureHeader.length === expected.length &&
      timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))

    if (!isValid) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  // Reservado para procesar mensajes entrantes y ACKs en el futuro.
  return Response.json({ status: 'ok', provider: 'whatsapp-gateway' })
}
