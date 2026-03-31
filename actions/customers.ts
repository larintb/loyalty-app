'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCachedBusinessId } from '@/lib/auth-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/utils/phone'
import type { CustomerInsert } from '@/types/database'

type ActionState = { error?: string; customerId?: string } | null

type LegalDocType = 'privacy_notice' | 'terms_conditions' | 'rewards_terms'

type LegalDocVersion = {
  id: string
  business_id: string | null
  doc_type: LegalDocType
  version_label: string
  title: string
  body_markdown: string
  content_hash: string
}

// ─── Buscar cliente por teléfono (usado en POS) ───────────────────────────────

export async function searchCustomerByPhone(phone: string) {
  const supabase = await createClient()

  // Obtener el business_id del usuario actual
  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

  const normalized = normalizePhone(phone)

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, total_points, visit_count, last_visit_at')
    .eq('business_id', businessId)
    .eq('phone', normalized)
    .eq('is_active', true)
    .maybeSingle()

  return data
}

// ─── Registrar cliente nuevo ───────────────────────────────────────────────────

export async function registerCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No se encontró el negocio.' }

  const phone = normalizePhone(formData.get('phone') as string)
  const name = (formData.get('name') as string).trim()
  const email = (formData.get('email') as string | null) || null
  const birthday = (formData.get('birthday') as string | null) || null
  const acceptedRewards = formData.get('accepted_rewards_program') === 'on'
  const acceptedLegal = formData.get('accepted_legal_terms') === 'on'
  const signatureDataUrl = (formData.get('signature_data_url') as string | null) ?? ''

  if (!phone || phone.length < 10) {
    return { error: 'Teléfono inválido. Ingresa 10 dígitos.' }
  }
  if (!name) {
    return { error: 'El nombre es requerido.' }
  }
  if (!acceptedRewards) {
    return { error: 'Debes aceptar la inscripción al sistema de recompensas.' }
  }
  if (!acceptedLegal) {
    return { error: 'Debes aceptar aviso de privacidad y términos.' }
  }
  if (!signatureDataUrl.startsWith('data:image/png;base64,')) {
    return { error: 'Firma inválida. Captura la firma del cliente.' }
  }

  // Verificar capacidad del plan (el trigger DB también lo valida)
  const { data: business } = await supabase
    .from('businesses')
    .select('plan_status, plan_id')
    .eq('id', businessId)
    .single()

  if (!business) return { error: 'Negocio no encontrado.' }

  if (!['active', 'trialing'].includes(business.plan_status)) {
    return { error: 'Suscripción inactiva. Actualiza tu plan para registrar clientes.' }
  }

  // Verificar capacidad según el plan
  if (business.plan_id) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('max_customers')
      .eq('id', business.plan_id)
      .single()

    if (plan?.max_customers != null) {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)

      if ((count ?? 0) >= plan.max_customers) {
        return {
          error: `Límite de ${plan.max_customers} clientes alcanzado. Actualiza tu plan.`,
        }
      }
    }
  }

  const insert: CustomerInsert = { business_id: businessId, phone, name, email, birthday }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert(insert)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este número ya está registrado en tu negocio.' }
    }
    // Errores del trigger de capacidad
    if (error.message?.includes('capacity_exceeded')) {
      return { error: 'Límite de clientes alcanzado. Actualiza tu plan.' }
    }
    return { error: 'Error al registrar el cliente. Intenta de nuevo.' }
  }

  const consentSaved = await saveCustomerConsent({
    supabase,
    businessId,
    customerId: customer.id,
    customerName: name,
    customerPhone: phone,
    signatureDataUrl,
  })

  if (consentSaved.error) {
    // Evitar clientes huérfanos sin consentimiento en el nuevo flujo obligatorio.
    await supabase.from('customers').delete().eq('id', customer.id)
    return { error: consentSaved.error }
  }

  // Bono de bienvenida si está configurado
  const { data: bizConfig } = await supabase
    .from('businesses')
    .select('points_config')
    .eq('id', businessId)
    .single()

  const welcomeBonus = bizConfig?.points_config?.welcome_bonus ?? 0

  if (welcomeBonus > 0) {
    await supabase.from('points_ledger').insert({
      business_id: businessId,
      customer_id: customer.id,
      type: 'welcome',
      points_delta: welcomeBonus,
      balance_after: welcomeBonus,
      note: 'Bono de bienvenida',
    })
  }

  return { customerId: customer.id }
}

// ─── Obtener perfil completo del cliente ──────────────────────────────────────

export async function getCustomerProfile(customerId: string) {
  const supabase = await createClient()

  const businessId = await getBusinessId(supabase)
  if (!businessId) return null

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (!customer) return null

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, total, items, ticket_number, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: pointsHistory } = await supabase
    .from('points_ledger')
    .select('type, points_delta, balance_after, note, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: consent } = await (supabase as any)
    .from('customer_consents' as any)
    .select('id, signed_at, signer_name_typed, signer_phone, signature_path, contract_snapshot_json, revoked_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let signatureSignedUrl: string | null = null
  const signaturePath = (consent as any)?.signature_path as string | undefined
  if (signaturePath) {
    const admin = createAdminClient()
    const { data: signed, error: signedError } = await (admin.storage as any)
      .from('consent-signatures')
      .createSignedUrl(signaturePath, 60 * 60)

    if (!signedError) {
      signatureSignedUrl = signed?.signedUrl ?? null
    }
  }

  return {
    customer,
    transactions: transactions ?? [],
    pointsHistory: pointsHistory ?? [],
    consent: consent
      ? {
          ...(consent as any),
          signature_signed_url: signatureSignedUrl,
        }
      : null,
  }
}

// ─── Listar clientes del negocio ──────────────────────────────────────────────

export async function getCustomers(search?: string) {
  const businessId = await getCachedBusinessId()
  if (!businessId) return []

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('id, name, phone, email, total_points, lifetime_spend, visit_count, last_visit_at, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    const normalized = normalizePhone(search)
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${normalized}%`)
  }

  const { data } = await query
  const customers = data ?? []

  if (customers.length === 0) return customers

  const customerIds = customers.map((c) => c.id)
  const { data: consentRows } = await (supabase as any)
    .from('customer_consents' as any)
    .select('customer_id, revoked_at, created_at')
    .eq('business_id', businessId)
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })

  const latestByCustomer = new Map<string, { revoked_at: string | null }>()
  for (const row of (consentRows ?? []) as any[]) {
    if (!latestByCustomer.has(row.customer_id)) {
      latestByCustomer.set(row.customer_id, { revoked_at: row.revoked_at ?? null })
    }
  }

  return customers.map((c) => {
    const consent = latestByCustomer.get(c.id)
    const consent_status = !consent
      ? 'missing'
      : consent.revoked_at
        ? 'revoked'
        : 'signed'

    return {
      ...c,
      consent_status,
    }
  })
}

export async function revokeCustomerConsent(
  consentId: string,
  customerId: string,
  reason?: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const businessId = await getBusinessId(supabase)
  if (!businessId) return { error: 'No se encontró el negocio.' }

  const revokeReason = (reason ?? '').trim() || 'Revocado manualmente por staff'

  const now = new Date().toISOString()
  const { error: updateError } = await (supabase as any)
    .from('customer_consents' as any)
    .update({
      revoked_at: now,
      revoke_reason: revokeReason,
    })
    .eq('id', consentId)
    .eq('business_id', businessId)
    .is('revoked_at', null)

  if (updateError) {
    return { error: 'No se pudo revocar el consentimiento.' }
  }

  await (supabase as any)
    .from('customer_consent_events' as any)
    .insert({
      consent_id: consentId,
      event_type: 'revoked',
      payload_json: {
        reason: revokeReason,
        at: now,
      },
    })

  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/customers')

  return { success: true }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (business) return business.id

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return staff?.business_id ?? null
}

async function getActiveLegalVersions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<{ privacy?: LegalDocVersion; terms?: LegalDocVersion; rewards?: LegalDocVersion }> {
  const { data: rows } = await (supabase as any)
    .from('legal_document_versions' as any)
    .select('id, business_id, doc_type, version_label, title, body_markdown, content_hash, created_at' as any)
    .eq('is_active', true)
    .in('doc_type', ['privacy_notice', 'terms_conditions', 'rewards_terms'])
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order('created_at', { ascending: false })

  const candidates = (rows ?? []) as (LegalDocVersion & { created_at?: string })[]

  const pick = (type: LegalDocType): LegalDocVersion | undefined => {
    const ofType = candidates.filter((r) => r.doc_type === type)
    return ofType.find((r) => r.business_id === businessId) ?? ofType[0]
  }

  return {
    privacy: pick('privacy_notice'),
    terms: pick('terms_conditions'),
    rewards: pick('rewards_terms'),
  }
}

async function saveCustomerConsent({
  supabase,
  businessId,
  customerId,
  customerName,
  customerPhone,
  signatureDataUrl,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  businessId: string
  customerId: string
  customerName: string
  customerPhone: string
  signatureDataUrl: string
}): Promise<{ error?: string }> {
  const legal = await getActiveLegalVersions(supabase, businessId)
  if (!legal.privacy || !legal.terms || !legal.rewards) {
    return { error: 'Faltan documentos legales activos. Configura versiones activas antes de registrar.' }
  }

  const b64 = signatureDataUrl.replace('data:image/png;base64,', '')
  const bytes = Buffer.from(b64, 'base64')
  if (!bytes.length) {
    return { error: 'No se pudo procesar la firma.' }
  }

  const admin = createAdminClient()
  const bucket = 'consent-signatures'
  await (admin.storage as any).createBucket(bucket, { public: false }).catch(() => {})

  const signaturePath = `${businessId}/${customerId}/signature-${Date.now()}.png`
  const { error: uploadError } = await (admin.storage as any)
    .from(bucket)
    .upload(signaturePath, bytes, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    return { error: 'No se pudo guardar la firma del cliente.' }
  }

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id ?? null

  let staffId: string | null = null
  if (userId) {
    const { data: staff } = await supabase
      .from('staff_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle()
    staffId = staff?.id ?? null
  }

  const h = await headers()
  const signerIp = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null
  const signerUa = h.get('user-agent') ?? null

  const signedAt = new Date().toISOString()
  const snapshot = {
    signedAt,
    customer: {
      id: customerId,
      name: customerName,
      phone: customerPhone,
    },
    accepted: {
      rewardsProgram: true,
      privacyNotice: true,
      termsConditions: true,
    },
    documents: {
      privacy: legal.privacy,
      terms: legal.terms,
      rewards: legal.rewards,
    },
  }

  const { data: consent, error: consentError } = await (supabase as any)
    .from('customer_consents' as any)
    .insert({
      business_id: businessId,
      customer_id: customerId,
      signed_by_staff_id: staffId,
      privacy_version_id: legal.privacy.id,
      terms_version_id: legal.terms.id,
      rewards_version_id: legal.rewards.id,
      accepted_rewards_program: true,
      accepted_privacy_notice: true,
      accepted_terms_conditions: true,
      signature_path: signaturePath,
      contract_snapshot_json: snapshot,
      signed_at: signedAt,
      signer_name_typed: customerName,
      signer_phone: customerPhone,
      signer_ip: signerIp,
      signer_user_agent: signerUa,
      signer_device: 'pos_app',
    })
    .select('id')
    .single()

  if (consentError || !consent) {
    return { error: 'No se pudo guardar el consentimiento del cliente.' }
  }

  await (supabase as any)
    .from('customer_consent_events' as any)
    .insert({
      consent_id: consent.id,
      event_type: 'created',
      payload_json: {
        source: 'register_customer',
        signedAt,
      },
    })

  return {}
}
