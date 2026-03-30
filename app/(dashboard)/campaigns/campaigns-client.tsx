'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Megaphone, Play, Pause, Send, ShieldCheck, AlertTriangle,
  Upload, X, Loader2, Users, MoreHorizontal, Plus,
  CheckCircle2, XCircle, Ban, Clock, Eye,
} from 'lucide-react'
import {
  createCampaign,
  getCampaignRecipients,
  launchCampaign,
  pauseCampaign,
  processCampaignBatch,
  type CampaignListItem,
  type CampaignPageData,
  type CampaignRecipient,
} from '@/actions/campaigns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type Props = {
  initialData: CampaignPageData
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  running: 'En curso',
  paused: 'Pausada',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
  failed: 'Fallida',
}

const ACTIVE_STATUSES = new Set(['draft', 'scheduled', 'running', 'paused'])

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[11px] px-2 py-0.5">En curso</Badge>
  if (status === 'completed') return <Badge variant="secondary" className="text-[11px] px-2 py-0.5">Finalizada</Badge>
  if (status === 'paused') return <Badge variant="destructive" className="text-[11px] px-2 py-0.5">Pausada</Badge>
  if (status === 'scheduled') return <Badge className="bg-blue-600 hover:bg-blue-600 text-[11px] px-2 py-0.5">Programada</Badge>
  if (status === 'draft') return <Badge variant="outline" className="text-[11px] px-2 py-0.5">Borrador</Badge>
  if (status === 'failed') return <Badge variant="destructive" className="text-[11px] px-2 py-0.5">Fallida</Badge>
  return <Badge variant="outline" className="text-[11px] px-2 py-0.5">{STATUS_LABEL[status] ?? status}</Badge>
}

function StatCell({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/40 px-2 py-1.5 sm:px-3 sm:py-2">
      <span className={color}>{icon}</span>
      <span className="text-sm font-bold tabular-nums sm:text-base">{value}</span>
      <span className="text-[9px] text-muted-foreground sm:text-[10px]">{label}</span>
    </div>
  )
}

function CampaignCard({
  campaign,
  onLaunch,
  onProcess,
  onPause,
  onPreview,
  onDetail,
  isPending,
}: {
  campaign: CampaignListItem
  onLaunch: () => void
  onProcess: () => void
  onPause: () => void
  onPreview: () => void
  onDetail: () => void
  isPending: boolean
}) {
  const total = campaign.sent + campaign.queued
  const pct = total > 0 ? Math.round((campaign.sent / total) * 100) : 0

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={campaign.status} />
            <p className="font-semibold text-sm leading-tight truncate">{campaign.name}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {campaign.audienceLabel} · {new Date(campaign.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="icon-sm" variant="ghost" disabled={isPending} className="shrink-0" />}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDetail}>
              <Users className="h-3.5 w-3.5" />
              Ver destinatarios
            </DropdownMenuItem>
            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
              <>
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLaunch}>
                  <Play className="h-3.5 w-3.5" />
                  Enviar ahora
                </DropdownMenuItem>
              </>
            )}
            {campaign.status === 'running' && (
              <>
                <DropdownMenuItem onClick={onProcess}>
                  <Send className="h-3.5 w-3.5" />
                  Procesar lote
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onPause}>
                  <Pause className="h-3.5 w-3.5" />
                  Pausar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatCell icon={<CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} value={campaign.sent} label="Enviados" color="text-emerald-600" />
        <StatCell icon={<XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} value={campaign.failed} label="Fallidos" color="text-red-500" />
        <StatCell icon={<Ban className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} value={campaign.blocked} label="Bloqueados" color="text-amber-500" />
        <StatCell icon={<Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} value={campaign.queued} label="En cola" color="text-blue-500" />
      </div>

      {/* Progress bar — solo para campañas activas con envíos */}
      {campaign.status === 'running' && total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progreso de envío</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
      )}

      {/* Inline actions para estados activos */}
      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onPreview} disabled={isPending} className="gap-1.5 flex-1">
            <Eye className="h-3.5 w-3.5" />
            Preview y enviar
          </Button>
        </div>
      )}

      {campaign.status === 'running' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onProcess} disabled={isPending} className="gap-1.5 flex-1">
            <Send className="h-3.5 w-3.5" />
            Procesar lote
          </Button>
          <Button size="sm" variant="destructive" onClick={onPause} disabled={isPending} className="gap-1.5">
            <Pause className="h-3.5 w-3.5" />
            Pausar
          </Button>
        </div>
      )}

      {campaign.status === 'paused' && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Campaña pausada
        </div>
      )}
    </div>
  )
}

function WhatsAppPreview({ message, imageUrl }: { message: string; imageUrl?: string }) {
  const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="bg-[#0B141A] text-white px-3 py-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Maria Cliente</p>
          <p className="text-[11px] text-white/70">en linea</p>
        </div>
        <p className="text-[11px] text-white/60">Preview</p>
      </div>
      <div className="relative bg-[#EDE5DA] p-4 min-h-40">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20px 20px, rgba(255,255,255,0.7) 1px, transparent 0)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 shadow-sm border border-green-200/60 space-y-2">
          {imageUrl && (
            <img src={imageUrl} alt="Preview" className="w-full max-h-40 object-cover rounded-lg border border-green-200" />
          )}
          <p className="text-[13px] leading-relaxed text-[#111B21] whitespace-pre-wrap">{message || '...'}</p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781]">
            <span>{time}</span>
            <span>✓✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Recipients list: cards on mobile, table on sm+ ─────────────────────────── */
function RecipientStatusBadge({ status }: { status: string }) {
  if (status === 'sent' || status === 'delivered')
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Enviado</Badge>
  if (status === 'queued')
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">En cola</Badge>
  if (status === 'blocked')
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700">Bloqueado</Badge>
  return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Fallido</Badge>
}

function RecipientsList({ recipients }: { recipients: CampaignRecipient[] }) {
  return (
    <>
      {/* Mobile: list of rows */}
      <div className="sm:hidden space-y-2">
        {recipients.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{r.customerName}</span>
              <RecipientStatusBadge status={r.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{r.phone}</span>
              <span className="tabular-nums">{r.points} pts</span>
            </div>
            {(r.blockedReason || r.sentAt) && (
              <p className="text-[11px] text-muted-foreground/80">
                {r.blockedReason ?? new Date(r.sentAt!).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* sm+: table */}
      <div className="hidden sm:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Cliente</th>
              <th className="pb-2 font-medium">Teléfono</th>
              <th className="pb-2 font-medium text-right">Puntos</th>
              <th className="pb-2 font-medium text-center">Estado</th>
              <th className="pb-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recipients.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="py-2 pr-3 font-medium">{r.customerName}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.phone}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.points}</td>
                <td className="py-2 pr-3 text-center">
                  <RecipientStatusBadge status={r.status} />
                </td>
                <td className="py-2 text-muted-foreground">
                  {r.blockedReason ?? (r.sentAt ? new Date(r.sentAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function CampaignsClient({ initialData }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sheet de creación
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    audiencePreset: 'todos',
    imageUrl: '',
    imagePreview: '',
    messageBody:
      'Hola {{name}} 👋\n\nTienes *{{points}} puntos* en {{business_name}} y esta semana los puedes aprovechar al máximo.\n\nTenemos un beneficio exclusivo para clientes frecuentes como tú. ¿Te interesa?\n\nResponde *SÍ* y te damos todos los detalles 🎁',
  })

  // Dialog preview (para campañas existentes en borrador)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null)

  // Dialog destinatarios
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCampaignName, setDetailCampaignName] = useState('')
  const [detailRecipients, setDetailRecipients] = useState<CampaignRecipient[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const activeCampaigns = useMemo(
    () => initialData.campaigns.filter((c) => ACTIVE_STATUSES.has(c.status)),
    [initialData.campaigns]
  )
  const historyCampaigns = useMemo(
    () => initialData.campaigns.filter((c) => !ACTIVE_STATUSES.has(c.status)),
    [initialData.campaigns]
  )

  const previewCampaign = useMemo(
    () => initialData.campaigns.find((c) => c.id === previewCampaignId) ?? null,
    [initialData.campaigns, previewCampaignId]
  )

  const livePreviewMessage = useMemo(() =>
    form.messageBody
      .replaceAll('{{name}}', 'Maria')
      .replaceAll('{{points}}', '180')
      .replaceAll('{{business_name}}', 'Tu Negocio'),
    [form.messageBody]
  )

  const existingPreviewMessage = useMemo(() => {
    if (!previewCampaign) return ''
    return previewCampaign.messageBody
      .replaceAll('{{name}}', 'Maria')
      .replaceAll('{{points}}', '180')
      .replaceAll('{{business_name}}', 'Tu Negocio')
  }, [previewCampaign])

  function resetForm() {
    setForm({
      name: '',
      audiencePreset: 'todos',
      imageUrl: '',
      imagePreview: '',
      messageBody:
        'Hola {{name}} 👋\n\nTienes *{{points}} puntos* en {{business_name}} y esta semana los puedes aprovechar al máximo.\n\nTenemos un beneficio exclusivo para clientes frecuentes como tú. ¿Te interesa?\n\nResponde *SÍ* y te damos todos los detalles 🎁',
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCreateCampaign() {
    if (!form.name.trim()) {
      toast.error('Escribe un nombre para la campaña.')
      return
    }
    if (!form.messageBody.trim()) {
      toast.error('El mensaje no puede ir vacío.')
      return
    }

    startTransition(async () => {
      const audienceRules =
        form.audiencePreset === 'vip'
          ? { minPoints: 150 }
          : form.audiencePreset === 'todos'
            ? {}
            : { inactiveDays: 14 }

      const result = await createCampaign({
        name: form.name,
        messageBody: form.messageBody,
        imageUrl: form.imageUrl || undefined,
        ...audienceRules,
      })

      if (!result.success) {
        toast.error(result.error ?? 'No se pudo crear la campaña.')
        return
      }

      toast.success('Campaña creada.')
      setSheetOpen(false)
      resetForm()
      router.refresh()
    })
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('La imagen no debe exceder 15MB.')
      return
    }

    const localPreview = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, imagePreview: localPreview }))
    setUploadingImage(true)

    try {
      const uploadForm = new FormData()
      uploadForm.append('file', file)

      const response = await fetch('/api/upload-campaign-photo', { method: 'POST', body: uploadForm })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.imageUrl) throw new Error(data?.error || 'No se pudo subir la imagen')

      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }))
      toast.success('Imagen subida correctamente.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al subir imagen.'
      toast.error(message)
      setForm((prev) => ({ ...prev, imageUrl: '', imagePreview: '' }))
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleLaunch(campaignId: string) {
    startTransition(async () => {
      const result = await launchCampaign(campaignId)
      if (!result.success) { toast.error(result.error ?? 'No se pudo iniciar la campaña.'); return }
      toast.success(result.message ?? 'Campaña iniciada.')
      router.refresh()
    })
  }

  function handleProcess(campaignId: string) {
    startTransition(async () => {
      const result = await processCampaignBatch(campaignId, 30)
      if (!result.success) { toast.error(result.error ?? 'No se pudo procesar el lote.'); return }
      toast.success(`Lote procesado. Enviados: ${result.sent ?? 0}. Fallidos: ${result.failed ?? 0}.`)
      router.refresh()
    })
  }

  function handlePause(campaignId: string) {
    startTransition(async () => {
      const result = await pauseCampaign(campaignId)
      if (!result.success) { toast.error(result.error ?? 'No se pudo pausar la campaña.'); return }
      toast.success('Campaña pausada.')
      router.refresh()
    })
  }

  function openPreview(campaignId: string) {
    setPreviewCampaignId(campaignId)
    setPreviewOpen(true)
  }

  function handleSendFromPreview() {
    if (!previewCampaign) return
    setPreviewOpen(false)
    handleLaunch(previewCampaign.id)
  }

  async function openDetail(campaignId: string, campaignName: string) {
    setDetailCampaignName(campaignName)
    setDetailRecipients([])
    setDetailOpen(true)
    setLoadingDetail(true)

    const result = await getCampaignRecipients(campaignId)
    setLoadingDetail(false)

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo cargar el detalle.')
      setDetailOpen(false)
      return
    }
    setDetailRecipients(result.recipients ?? [])
  }

  const stats = initialData.summary

  return (
    <div className="space-y-5">
      {/* KPI strip — 2×2 en móvil, 4 en línea desde sm */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Campañas</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-300/60">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">En curso</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.running}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-300/60">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Enviados hoy</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sentToday}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-300/60">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Bloqueados hoy</p>
            <p className="text-2xl font-bold text-amber-600">{stats.blockedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + botón nueva campaña */}
      <Tabs defaultValue="active">
        <div className="flex items-center justify-between gap-3">
          <TabsList variant="line">
            <TabsTrigger value="active">
              Activas
              {activeCampaigns.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                  {activeCampaigns.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              Historial
              {historyCampaigns.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {historyCampaigns.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Button size="sm" onClick={() => setSheetOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Nueva campaña</span>
            <span className="xs:hidden">Nueva</span>
          </Button>
        </div>

        {/* Tab: Activas */}
        <TabsContent value="active" className="mt-4">
          {activeCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center space-y-2">
              <Megaphone className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No hay campañas activas</p>
              <p className="text-xs text-muted-foreground/70">Crea una nueva campaña para empezar a enviar mensajes.</p>
              <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)} className="mt-2 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nueva campaña
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onLaunch={() => handleLaunch(campaign.id)}
                  onProcess={() => handleProcess(campaign.id)}
                  onPause={() => handlePause(campaign.id)}
                  onPreview={() => openPreview(campaign.id)}
                  onDetail={() => openDetail(campaign.id, campaign.name)}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="history" className="mt-4">
          {historyCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center">
              <p className="text-sm text-muted-foreground">Aún no hay campañas finalizadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onLaunch={() => handleLaunch(campaign.id)}
                  onProcess={() => handleProcess(campaign.id)}
                  onPause={() => handlePause(campaign.id)}
                  onPreview={() => openPreview(campaign.id)}
                  onDetail={() => openDetail(campaign.id, campaign.name)}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Sheet: Nueva campaña ── */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent className="flex flex-col overflow-hidden w-full sm:max-w-xl">
          <SheetHeader className="px-6 pt-6 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Nueva campaña
            </SheetTitle>
            <SheetDescription>
              Completa los datos y revisa el preview antes de crear.
            </SheetDescription>
          </SheetHeader>

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Formulario */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-name">Nombre de la campaña</Label>
                <Input
                  id="sheet-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Reactivación semana 1"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Audiencia</Label>
                <Select
                  value={form.audiencePreset}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, audiencePreset: v ?? prev.audiencePreset }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reactivar">Clientes inactivos (14 días)</SelectItem>
                    <SelectItem value="vip">Clientes VIP (150+ puntos)</SelectItem>
                    <SelectItem value="todos">Todos con opt-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sheet-msg">
                  Mensaje
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    {'{{name}}'} · {'{{points}}'} · {'{{business_name}}'}
                  </span>
                </Label>
                <Textarea
                  id="sheet-msg"
                  rows={6}
                  value={form.messageBody}
                  onChange={(e) => setForm((prev) => ({ ...prev, messageBody: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground text-right">{form.messageBody.length}/800</p>
              </div>

              {/* Imagen */}
              <div className="space-y-2">
                <Label>Foto (opcional)</Label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                {form.imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                    <img src={form.imagePreview} alt="Preview foto" className="w-full h-32 object-cover" />
                    <Button
                      size="sm" variant="ghost"
                      className="absolute top-1 right-1 h-6 w-6 p-0 hover:bg-red-100"
                      onClick={() => setForm((prev) => ({ ...prev, imageUrl: '', imagePreview: '' }))}
                      disabled={uploadingImage}
                    >
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button" variant="outline" className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingImage ? 'Subiendo...' : 'Subir imagen'}
                  </Button>
                )}
              </div>
            </div>

            {/* Preview en vivo — siempre visible, debajo del form */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview en vivo</p>
              <WhatsAppPreview message={livePreviewMessage} imageUrl={form.imagePreview || undefined} />
            </div>

            {/* Guardrails */}
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Guardrails activos
              </p>
              <p>Solo clientes con opt-in · Lista de supresión · Cooldown y límite diario automáticos · Envío por lotes</p>
            </div>
          </div>

          <SheetFooter className="px-6 pb-6 pt-4 flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setSheetOpen(false); resetForm() }} disabled={isPending} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleCreateCampaign} disabled={isPending || uploadingImage} className="gap-1.5 w-full sm:w-auto">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Crear campaña
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: destinatarios ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Destinatarios — {detailCampaignName}
            </DialogTitle>
            <DialogDescription>
              Lista de clientes incluidos en esta campaña y su resultado.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailRecipients.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aún no hay destinatarios registrados para esta campaña.
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-3">
              {/* Resumen de estados */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(['sent', 'queued', 'blocked', 'failed'] as const).map((s) => {
                  const labels: Record<string, string> = { sent: 'Enviados', queued: 'En cola', blocked: 'Bloqueados', failed: 'Fallidos' }
                  const count = s === 'sent'
                    ? detailRecipients.filter((r) => r.status === 'sent' || r.status === 'delivered').length
                    : detailRecipients.filter((r) => r.status === s).length
                  if (count === 0) return null
                  return <span key={s} className="rounded-full bg-muted px-2 py-0.5">{labels[s]}: {count}</span>
                })}
              </div>
              <RecipientsList recipients={detailRecipients} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: preview campaña existente ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview del borrador</DialogTitle>
            <DialogDescription>
              Revisa el mensaje como lo verá el cliente antes de enviarlo.
            </DialogDescription>
          </DialogHeader>

          {previewCampaign && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <p><span className="font-medium">Campaña:</span> {previewCampaign.name}</p>
                <p><span className="font-medium">Audiencia:</span> {previewCampaign.audienceLabel}</p>
              </div>

              <WhatsAppPreview message={existingPreviewMessage} imageUrl={previewCampaign.imageUrl ?? undefined} />

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Protecciones anti-spam activas</p>
                <p>Solo clientes con opt-in · Cooldown automático · Límite diario</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={isPending} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleSendFromPreview} disabled={isPending} className="gap-1.5 w-full sm:w-auto">
                  <Send className="h-4 w-4" />
                  Confirmar y enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
