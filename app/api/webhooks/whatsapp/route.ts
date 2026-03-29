// Meta requiere este endpoint para verificar el webhook al configurarlo
// GET: Meta llama con hub.challenge y espera que lo devuelvas
// POST: Meta envía mensajes entrantes (no los procesamos por ahora)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.META_WA_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST() {
  // Por ahora solo confirmamos recepción
  // Aquí podrías procesar mensajes entrantes (respuestas de clientes)
  return Response.json({ status: 'ok' })
}
