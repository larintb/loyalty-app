// Webhook para eventos de WhatsApp via Whapi.
// Whapi no requiere el flujo hub.challenge de Meta.

export async function GET() {
  return Response.json({ status: 'ok', provider: 'whapi' })
}

export async function POST(request: Request) {
  const configuredSecret = process.env.WHAPI_WEBHOOK_SECRET
  const { searchParams } = new URL(request.url)

  const bearer = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')

  const headerSecret = request.headers.get('x-webhook-secret')
  const querySecret = searchParams.get('token')

  if (
    configuredSecret &&
    configuredSecret !== bearer &&
    configuredSecret !== headerSecret &&
    configuredSecret !== querySecret
  ) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Reservado para procesar mensajes entrantes/estados de entrega en el futuro.
  await request.json().catch(() => null)
  return Response.json({ status: 'ok', provider: 'whapi' })
}
