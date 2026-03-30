'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PointsConfig, RedeemableProductRow } from '@/types/database'

export async function getBusinessSettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('businesses')
    .select('id, name, phone, address, email, logo_url, points_config, plan_status, trial_ends_at')
    .eq('owner_id', user.id)
    .single()

  if (!data) return null

  // También obtener productos canjeables
  const { data: redeemables } = await supabase
    .from('redeemable_products' as any)
    .select('*')
    .eq('business_id', data.id)
    .order('created_at', { ascending: false })

  return {
    ...data,
    redeemable_products: (redeemables || []) as unknown as RedeemableProductRow[],
  }
}

export async function updateBusinessInfo(payload: {
  name: string
  phone?: string
  address?: string
  email?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  if (!payload.name.trim()) return { error: 'El nombre del negocio es requerido.' }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      email: payload.email?.trim() || null,
    })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar los datos del negocio.' }
  return { success: true }
}

const BUCKET = 'business-logos'

export async function getLogoUploadUrl(
  fileName: string
): Promise<{ signedUrl?: string; path?: string; publicUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado.' }

  const admin = createAdminClient()

  // Crear bucket si no existe (idempotente)
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const ext = (fileName.split('.').pop() ?? 'png').toLowerCase()
  const path = `${business.id}/logo.${ext}`

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true })

  if (error || !data) return { error: 'No se pudo generar la URL de subida.' }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  return { signedUrl: data.signedUrl, path, publicUrl }
}

export async function saveBusinessLogoUrl(
  logoUrl: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase
    .from('businesses')
    .update({ logo_url: logoUrl || null })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar el logo.' }
  return {}
}

export async function updatePointsConfig(
  config: PointsConfig
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase
    .from('businesses')
    .update({ points_config: config })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar la configuración de puntos.' }
  return { success: true }
}
