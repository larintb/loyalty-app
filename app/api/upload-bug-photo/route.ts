import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener usuario
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Obtener business_id
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    let businessId = business?.id

    if (!businessId) {
      const { data: staff } = await ((supabase as any)
        .from('staff_members')
        .select('business_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle())

      businessId = staff?.business_id
    }

    if (!businessId) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    // Parsear FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    // Convertir archivo a buffer
    const buffer = await file.arrayBuffer()
    const fileName = `${businessId}/${Date.now()}_${file.name}`

    // Usar admin client para bypassear RLS
    const adminSupabase = await createAdminClient()

    // Subir a Supabase
    try {
      const { error: uploadError } = await ((adminSupabase.storage as any)
        .from('bug-reports')
        .upload(fileName, new Uint8Array(buffer), {
          contentType: file.type,
          upsert: false,
        }))

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          status: uploadError.status,
          statusCode: uploadError.statusCode,
          error: uploadError,
        })
        return NextResponse.json(
          { error: `Error al subir archivo: ${uploadError.message}` },
          { status: 500 }
        )
      }

      // Obtener URL pública
      const { data } = ((adminSupabase.storage as any)
        .from('bug-reports')
        .getPublicUrl(fileName))

      return NextResponse.json({ photoUrl: data.publicUrl })
    } catch (uploadErr) {
      console.error('Upload exception:', uploadErr)
      throw uploadErr
    }
  } catch (error) {
    console.error('Route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error al procesar: ${errorMessage}` },
      { status: 500 }
    )
  }
}
