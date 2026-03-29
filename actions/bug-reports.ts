'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'

export type BugReportPayload = {
  title: string
  description?: string
  photoUrl?: string
}

export type BugReportResult = 
  | { success: true; reportId: string }
  | { success: false; error: string }

export async function submitBugReport(payload: BugReportPayload): Promise<BugReportResult> {
  const supabase = await createClient()

  // Obtener usuario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado.' }

  // Obtener business_id
  const businessId = await getBusinessId(supabase, user.id)
  if (!businessId) return { success: false, error: 'Negocio no encontrado.' }

  // Crear reporte con URL de foto precargada
  const { data: report, error: insertError } = await ((supabase as any)
    .from('bug_reports')
    .insert({
      business_id: businessId,
      user_id: user.id,
      title: payload.title,
      description: payload.description || null,
      photo_url: payload.photoUrl || null,
      status: 'open',
    })
    .select('id')
    .single())

  if (insertError || !report) {
    return { success: false, error: 'Error al crear el reporte.' }
  }

  return { success: true, reportId: report.id }
}

async function getBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  // Primero intenta obtener como owner
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (business) return business.id

  // Si no, intenta como staff
  const { data: staff } = await ((supabase as any)
    .from('staff_members')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle())

  return staff?.business_id ?? null
}
