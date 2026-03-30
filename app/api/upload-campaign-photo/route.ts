import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'

async function getBusinessId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (business?.id) return business.id

  const { data: staff } = await ((supabase as any)
    .from('staff_members')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle())

  return staff?.business_id ?? null
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envio archivo' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imagenes' }, { status: 400 })
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no debe exceder 15MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${businessId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buffer = await file.arrayBuffer()

    const admin = await createAdminClient()

    await (admin.storage as any).createBucket('campaign-photos', { public: true }).catch(() => {})

    const { error: uploadError } = await ((admin.storage as any)
      .from('campaign-photos')
      .upload(fileName, new Uint8Array(buffer), {
        contentType: file.type,
        upsert: false,
      }))

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir imagen: ${uploadError.message}` }, { status: 500 })
    }

    const { data } = ((admin.storage as any)
      .from('campaign-photos')
      .getPublicUrl(fileName))

    return NextResponse.json({ imageUrl: data.publicUrl })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: `Error al procesar: ${errorMessage}` }, { status: 500 })
  }
}
