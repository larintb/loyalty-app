import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'

async function getBusinessId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (business?.id) return business.id

  const { data: staff } = await (supabase as any)
    .from('staff_members')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return staff?.business_id ?? null
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const businessId = await getBusinessId(supabase, user.id)
    if (!businessId) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    const { id } = await context.params

    const { data: consent } = await (supabase as any)
      .from('customer_consents' as any)
      .select('id, signed_at, signer_name_typed, signer_phone, signer_ip, signer_user_agent, signature_path, contract_snapshot_json, revoked_at, revoke_reason')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (!consent) {
      return NextResponse.json({ error: 'Consentimiento no encontrado' }, { status: 404 })
    }

    const snapshot = (consent.contract_snapshot_json ?? {}) as any

    const text = [
      'COMPROBANTE DE CONSENTIMIENTO',
      '=============================',
      `ID: ${consent.id}`,
      `Firmado el: ${consent.signed_at}`,
      `Firmante: ${consent.signer_name_typed}`,
      `Telefono: ${consent.signer_phone}`,
      `Revocado: ${consent.revoked_at ? 'Si' : 'No'}`,
      `${consent.revoked_at ? `Revocado el: ${consent.revoked_at}` : ''}`,
      `${consent.revoke_reason ? `Motivo de revocacion: ${consent.revoke_reason}` : ''}`,
      '',
      'DOCUMENTOS LEGALES',
      '------------------',
      `Privacidad: ${snapshot?.documents?.privacy?.version_label ?? 'N/D'}`,
      `Terminos: ${snapshot?.documents?.terms?.version_label ?? 'N/D'}`,
      `Recompensas: ${snapshot?.documents?.rewards?.version_label ?? 'N/D'}`,
      '',
      'METADATOS',
      '---------',
      `IP: ${consent.signer_ip ?? 'N/D'}`,
      `User-Agent: ${consent.signer_user_agent ?? 'N/D'}`,
      `Firma path: ${consent.signature_path ?? 'N/D'}`,
      '',
      'SNAPSHOT JSON',
      '-------------',
      JSON.stringify(snapshot, null, 2),
      '',
    ]
      .filter(Boolean)
      .join('\n')

    return new NextResponse(text, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="consent-${consent.id}.txt"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: `Error al generar comprobante: ${errorMessage}` }, { status: 500 })
  }
}
