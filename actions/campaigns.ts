'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { sendImageMessage, sendTextMessage } from '@/lib/whatsapp/client'

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

type CampaignSegment = {
  minPoints?: number
  inactiveDays?: number
}

type CampaignRules = {
  cooldownHours: number
  maxRecipients: number
  quietHoursStart: number
  quietHoursEnd: number
}

export type CampaignSummary = {
  total: number
  running: number
  sentToday: number
  blockedToday: number
}

export type CampaignListItem = {
  id: string
  name: string
  status: CampaignStatus
  createdAt: string
  scheduledAt: string | null
  messageBody: string
  imageUrl: string | null
  audienceLabel: string
  sent: number
  failed: number
  blocked: number
  queued: number
}

export type CampaignPageData = {
  summary: CampaignSummary
  campaigns: CampaignListItem[]
}

export type CreateCampaignInput = {
  name: string
  messageBody: string
  imageUrl?: string
  minPoints?: number
  inactiveDays?: number
  cooldownHours?: number
  maxRecipients?: number
  quietHoursStart?: number
  quietHoursEnd?: number
  scheduledAt?: string | null
}

async function getBusinessContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (business?.id) {
    const { data: staff } = await supabase
      .from('staff_members')
      .select('id')
      .eq('business_id', business.id)
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      userId: user.id,
      businessId: business.id,
      staffId: staff?.id ?? null,
    }
  }

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff) return null

  return {
    userId: user.id,
    businessId: staff.business_id,
    staffId: staff.id,
  }
}

function normalizeRules(input: CreateCampaignInput): CampaignRules {
  const cooldownHours = Math.max(1, Math.min(24 * 14, input.cooldownHours ?? 72))
  const maxRecipients = Math.max(1, Math.min(5000, input.maxRecipients ?? 200))
  const quietHoursStart = Math.max(0, Math.min(23, input.quietHoursStart ?? 9))
  const quietHoursEnd = Math.max(1, Math.min(24, input.quietHoursEnd ?? 20))

  return {
    cooldownHours,
    maxRecipients,
    quietHoursStart,
    quietHoursEnd,
  }
}

function normalizeSegment(input: CreateCampaignInput): CampaignSegment {
  const segment: CampaignSegment = {}

  if (typeof input.minPoints === 'number' && input.minPoints > 0) {
    segment.minPoints = Math.floor(input.minPoints)
  }

  if (typeof input.inactiveDays === 'number' && input.inactiveDays > 0) {
    segment.inactiveDays = Math.floor(input.inactiveDays)
  }

  return segment
}

function renderMessage(template: string, customerName: string, points: number, businessName: string) {
  return template
    .replaceAll('{{name}}', customerName)
    .replaceAll('{{points}}', String(points))
    .replaceAll('{{business_name}}', businessName)
}

export async function getCampaignPageData(): Promise<CampaignPageData> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)

  if (!context) {
    return {
      summary: { total: 0, running: 0, sentToday: 0, blockedToday: 0 },
      campaigns: [],
    }
  }

  const { data: campaigns } = await supabase
    .from('marketing_campaigns' as any)
    .select('id, name, status, created_at, scheduled_at, message_body, image_url, segment_json')
    .eq('business_id', context.businessId)
    .order('created_at', { ascending: false })
    .limit(30)

  const campaignIds = (campaigns ?? []).map((c: any) => c.id)

  let recipientRows: any[] = []
  if (campaignIds.length > 0) {
    const { data } = await supabase
      .from('marketing_campaign_recipients' as any)
      .select('campaign_id, status, created_at')
      .in('campaign_id', campaignIds)

    recipientRows = data ?? []
  }

  const statsByCampaign = new Map<string, { sent: number; failed: number; blocked: number; queued: number }>()
  for (const row of recipientRows) {
    const prev = statsByCampaign.get(row.campaign_id) ?? { sent: 0, failed: 0, blocked: 0, queued: 0 }

    if (row.status === 'sent' || row.status === 'delivered') prev.sent += 1
    if (row.status === 'failed') prev.failed += 1
    if (row.status === 'blocked') prev.blocked += 1
    if (row.status === 'queued') prev.queued += 1

    statsByCampaign.set(row.campaign_id, prev)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let sentToday = 0
  let blockedToday = 0
  for (const row of recipientRows) {
    const createdAt = new Date(row.created_at)
    if (createdAt < today) continue

    if (row.status === 'sent' || row.status === 'delivered') sentToday += 1
    if (row.status === 'blocked') blockedToday += 1
  }

  const normalizedCampaigns: CampaignListItem[] = (campaigns ?? []).map((c: any) => {
    const stats = statsByCampaign.get(c.id) ?? { sent: 0, failed: 0, blocked: 0, queued: 0 }
    const segment = (c.segment_json ?? {}) as CampaignSegment
    const audienceLabel = segment.minPoints
      ? `VIP (${segment.minPoints}+ pts)`
      : segment.inactiveDays
        ? `Inactivos (${segment.inactiveDays} dias)`
        : 'Todos con opt-in'

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.created_at,
      scheduledAt: c.scheduled_at,
      messageBody: c.message_body,
      imageUrl: c.image_url ?? null,
      audienceLabel,
      sent: stats.sent,
      failed: stats.failed,
      blocked: stats.blocked,
      queued: stats.queued,
    }
  })

  const summary: CampaignSummary = {
    total: normalizedCampaigns.length,
    running: normalizedCampaigns.filter((c) => c.status === 'running').length,
    sentToday,
    blockedToday,
  }

  return { summary, campaigns: normalizedCampaigns }
}

export async function createCampaign(input: CreateCampaignInput): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)

  if (!context) return { success: false, error: 'No autenticado.' }

  const name = input.name.trim()
  const messageBody = input.messageBody.trim()
  const imageUrl = input.imageUrl?.trim() || null

  if (name.length < 4) {
    return { success: false, error: 'El nombre de la campana debe tener al menos 4 caracteres.' }
  }

  if (messageBody.length < 15) {
    return { success: false, error: 'El mensaje es muy corto. Agrega mas contexto para evitar spam.' }
  }

  if (messageBody.length > 800) {
    return { success: false, error: 'El mensaje es muy largo. Reduce a 800 caracteres maximo.' }
  }

  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { success: false, error: 'La URL de foto debe empezar con http o https.' }
      }
    } catch {
      return { success: false, error: 'La URL de foto no es valida.' }
    }
  }

  const segment = normalizeSegment(input)
  const rules = normalizeRules(input)

  const { error } = await supabase
    .from('marketing_campaigns' as any)
    .insert({
      business_id: context.businessId,
      created_by: context.staffId,
      name,
      objective: 'reactivacion',
      status: input.scheduledAt ? 'scheduled' : 'draft',
      segment_json: segment,
      rules_json: rules,
      message_body: messageBody,
      image_url: imageUrl,
      scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    })

  if (error) {
    return { success: false, error: 'No se pudo crear la campana.' }
  }

  revalidatePath('/campaigns')
  return { success: true }
}

async function prepareAudience(campaignId: string, businessId: string) {
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from('marketing_campaigns' as any)
    .select('id, message_body, image_url, segment_json, rules_json, status')
    .eq('id', campaignId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!campaign) return { error: 'Campana no encontrada.' as string }
  const campaignRow = campaign as any

  const segment = (campaignRow.segment_json ?? {}) as CampaignSegment
  const rules = {
    ...normalizeRules({ name: 'x', messageBody: 'x' }),
    ...(campaignRow.rules_json ?? {}),
  } as CampaignRules

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, total_points, last_visit_at, is_active')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const { data: prefs } = await supabase
    .from('customer_marketing_prefs' as any)
    .select('customer_id, whatsapp_opt_in, last_marketing_sent_at')
    .in('customer_id', (customers ?? []).map((c) => c.id))

  const { data: suppressionRows } = await supabase
    .from('whatsapp_suppression_list' as any)
    .select('phone')
    .eq('business_id', businessId)

  const suppression = new Set((suppressionRows ?? []).map((r: any) => normalizePhone(String(r.phone))))
  const prefsByCustomer = new Map<string, any>()
  for (const p of (prefs ?? []) as any[]) {
    prefsByCustomer.set(p.customer_id, p)
  }

  const cooldownMs = rules.cooldownHours * 60 * 60 * 1000
  const minLastVisit = segment.inactiveDays
    ? Date.now() - segment.inactiveDays * 24 * 60 * 60 * 1000
    : null

  const recipientsToInsert: any[] = []

  for (const customer of customers ?? []) {
    const normalizedPhone = normalizePhone(customer.phone ?? '')
    const pref = prefsByCustomer.get(customer.id)

    let status: 'queued' | 'blocked' = 'queued'
    let blockedReason: string | null = null

    // Si no existe registro de preferencias, asumimos habilitado por ahora.
    // Solo bloqueamos cuando el cliente se marco explicitamente como opt-out.
    if (pref?.whatsapp_opt_in === false) {
      status = 'blocked'
      blockedReason = 'no_opt_in'
    } else if (suppression.has(normalizedPhone)) {
      status = 'blocked'
      blockedReason = 'suppressed'
    } else if (segment.minPoints && Number(customer.total_points) < segment.minPoints) {
      status = 'blocked'
      blockedReason = 'below_min_points'
    } else if (minLastVisit && customer.last_visit_at) {
      const lastVisit = new Date(customer.last_visit_at).getTime()
      if (lastVisit > minLastVisit) {
        status = 'blocked'
        blockedReason = 'recently_active'
      }
    } else if (pref?.last_marketing_sent_at) {
      const diff = Date.now() - new Date(pref.last_marketing_sent_at).getTime()
      if (diff < cooldownMs) {
        status = 'blocked'
        blockedReason = 'cooldown_active'
      }
    }

    recipientsToInsert.push({
      campaign_id: campaignRow.id,
      customer_id: customer.id,
      phone: normalizedPhone,
      status,
      blocked_reason: blockedReason,
    })
  }

  const queued = recipientsToInsert.filter((r) => r.status === 'queued').slice(0, rules.maxRecipients)
  const blocked = recipientsToInsert.filter((r) => r.status === 'blocked')
  const overflowBlocked = recipientsToInsert
    .filter((r) => r.status === 'queued')
    .slice(rules.maxRecipients)
    .map((r) => ({ ...r, status: 'blocked', blocked_reason: 'daily_limit_guard' }))

  const finalRows = [...queued, ...blocked, ...overflowBlocked]

  if (finalRows.length > 0) {
    await supabase
      .from('marketing_campaign_recipients' as any)
      .upsert(finalRows, { onConflict: 'campaign_id,customer_id' })
  }

  return {
    campaign: campaignRow,
    rules,
    queuedCount: queued.length,
  }
}

export async function launchCampaign(campaignId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)

  if (!context) return { success: false, error: 'No autenticado.' }

  const prep = await prepareAudience(campaignId, context.businessId)
  if ('error' in prep) return { success: false, error: prep.error }

  await supabase
    .from('marketing_campaigns' as any)
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('business_id', context.businessId)

  const batch = await processCampaignBatchInternal(
    campaignId,
    context.businessId,
    prep.campaign.message_body,
    prep.campaign.image_url ?? null,
    30
  )

  revalidatePath('/campaigns')
  if (!batch.success) return batch

  return {
    success: true,
    message: `Campana iniciada. Enviados ${batch.sent ?? 0} en el primer lote.`,
  }
}

async function processCampaignBatchInternal(
  campaignId: string,
  businessId: string,
  messageTemplate: string,
  imageUrl: string | null,
  batchSize: number
): Promise<{ success: boolean; error?: string; sent?: number; failed?: number }> {
  const supabase = await createClient()

  const { data: queued } = await supabase
    .from('marketing_campaign_recipients' as any)
    .select('id, customer_id, phone')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  const queuedRows = (queued ?? []) as any[]

  if (queuedRows.length === 0) {
    await supabase
      .from('marketing_campaigns' as any)
      .update({ status: 'completed', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('business_id', businessId)

    return { success: true, sent: 0, failed: 0 }
  }

  const { data: businessRow } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle()

  const businessName = (businessRow as any)?.name ?? ''

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, total_points')
    .in('id', queuedRows.map((q: any) => q.customer_id))

  const customersById = new Map<string, any>()
  for (const c of customers ?? []) {
    customersById.set(c.id, c)
  }

  let sent = 0
  let failed = 0

  for (const recipient of queuedRows) {
    const customer = customersById.get(recipient.customer_id)
    const customerName = customer?.name ?? 'cliente'
    const points = Number(customer?.total_points ?? 0)
    const personalized = renderMessage(messageTemplate, customerName, points, businessName)

    const waResult = imageUrl
      ? await sendImageMessage({ to: recipient.phone, imageUrl, caption: personalized })
      : await sendTextMessage(recipient.phone, personalized)

    if (waResult.success) {
      sent += 1
      await supabase
        .from('marketing_campaign_recipients' as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempt_count: 1,
          last_attempt_at: new Date().toISOString(),
          provider_message_id: waResult.messageId,
          provider_error: null,
        })
        .eq('id', recipient.id)

      await supabase
        .from('customer_marketing_prefs' as any)
        .upsert({
          customer_id: recipient.customer_id,
          whatsapp_opt_in: true,
          last_marketing_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'customer_id' })

      await supabase
        .from('marketing_campaign_events' as any)
        .insert({
          campaign_id: campaignId,
          recipient_id: recipient.id,
          event_type: 'sent',
          payload_json: { provider_message_id: waResult.messageId },
        })
    } else {
      failed += 1
      await supabase
        .from('marketing_campaign_recipients' as any)
        .update({
          status: 'failed',
          attempt_count: 1,
          last_attempt_at: new Date().toISOString(),
          provider_error: waResult.error,
        })
        .eq('id', recipient.id)

      await supabase
        .from('marketing_campaign_events' as any)
        .insert({
          campaign_id: campaignId,
          recipient_id: recipient.id,
          event_type: 'failed',
          payload_json: { error: waResult.error },
        })
    }
  }

  const { count: pending } = await supabase
    .from('marketing_campaign_recipients' as any)
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')

  if ((pending ?? 0) === 0) {
    await supabase
      .from('marketing_campaigns' as any)
      .update({ status: 'completed', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('business_id', businessId)
  }

  return { success: true, sent, failed }
}

export async function processCampaignBatch(
  campaignId: string,
  batchSize = 30
): Promise<{ success: boolean; error?: string; sent?: number; failed?: number }> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)

  if (!context) return { success: false, error: 'No autenticado.' }

  const { data: campaign } = await supabase
    .from('marketing_campaigns' as any)
    .select('id, business_id, message_body, image_url, status')
    .eq('id', campaignId)
    .eq('business_id', context.businessId)
    .maybeSingle()

  if (!campaign) return { success: false, error: 'Campana no encontrada.' }
  const campaignRow = campaign as any

  if (campaignRow.status === 'paused' || campaignRow.status === 'cancelled') {
    return { success: false, error: 'La campana esta pausada o cancelada.' }
  }

  const result = await processCampaignBatchInternal(
    campaignId,
    context.businessId,
    campaignRow.message_body,
    campaignRow.image_url ?? null,
    Math.max(1, Math.min(100, batchSize))
  )
  revalidatePath('/campaigns')
  return result
}

export type CampaignRecipient = {
  id: string
  customerName: string
  phone: string
  points: number
  status: string
  blockedReason: string | null
  sentAt: string | null
}

export async function getCampaignRecipients(campaignId: string): Promise<{ success: boolean; recipients?: CampaignRecipient[]; error?: string }> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)

  if (!context) return { success: false, error: 'No autenticado.' }

  const { data: campaign } = await supabase
    .from('marketing_campaigns' as any)
    .select('id')
    .eq('id', campaignId)
    .eq('business_id', context.businessId)
    .maybeSingle()

  if (!campaign) return { success: false, error: 'Campana no encontrada.' }

  const { data: rows } = await supabase
    .from('marketing_campaign_recipients' as any)
    .select('id, customer_id, phone, status, blocked_reason, sent_at')
    .eq('campaign_id', campaignId)
    .order('status', { ascending: true })
    .limit(500)

  const recipientRows = (rows ?? []) as any[]

  const customerIds = recipientRows.map((r) => r.customer_id)
  const customersById = new Map<string, { name: string; total_points: number }>()

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, total_points')
      .in('id', customerIds)

    for (const c of customers ?? []) {
      customersById.set(c.id, c)
    }
  }

  const BLOCKED_REASON_LABEL: Record<string, string> = {
    no_opt_in: 'Sin opt-in',
    suppressed: 'Lista de supresion',
    below_min_points: 'Puntos insuficientes',
    recently_active: 'Cliente activo recientemente',
    cooldown_active: 'Cooldown activo',
    daily_limit_guard: 'Limite diario alcanzado',
  }

  const recipients: CampaignRecipient[] = recipientRows.map((r) => {
    const customer = customersById.get(r.customer_id)
    return {
      id: r.id,
      customerName: customer?.name ?? 'Desconocido',
      phone: r.phone,
      points: Number(customer?.total_points ?? 0),
      status: r.status,
      blockedReason: r.blocked_reason ? (BLOCKED_REASON_LABEL[r.blocked_reason] ?? r.blocked_reason) : null,
      sentAt: r.sent_at ?? null,
    }
  })

  return { success: true, recipients }
}

export async function pauseCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const context = await getBusinessContext(supabase)
  if (!context) return { success: false, error: 'No autenticado.' }

  const { error } = await supabase
    .from('marketing_campaigns' as any)
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('business_id', context.businessId)

  if (error) return { success: false, error: 'No se pudo pausar la campana.' }

  revalidatePath('/campaigns')
  return { success: true }
}
