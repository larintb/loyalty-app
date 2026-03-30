'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Store,
  Phone,
  MapPin,
  Mail,
  Save,
  Check,
  Zap,
  Gift,
  Clock,
  ArrowRight,
  BadgePercent,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { RedeemablesSection } from '@/components/settings/redeemables-section'
import { LogoUpload } from '@/components/settings/logo-upload'
import { updateBusinessInfo, updatePointsConfig } from '@/actions/settings'
import type { PointsConfig, RedeemableProductRow } from '@/types/database'

type BusinessData = {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  logo_url: string | null
  points_config: PointsConfig
  redeemable_products: RedeemableProductRow[]
  plan_status: string | null
  trial_ends_at: string | null
}

export function TrialBadge({ trialEndsAt, planStatus }: { trialEndsAt: string | null; planStatus: string | null }) {
  const daysLeft = useMemo(() => {
    if (!trialEndsAt) return 0
    return Math.max(0, Math.ceil(
      // eslint-disable-next-line react-hooks/purity
      (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))
  }, [trialEndsAt])

  if (planStatus !== 'trialing' || !trialEndsAt) return null

  const isUrgent = daysLeft <= 3

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
      isUrgent
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      <Sparkles className="h-3.5 w-3.5" />
      {daysLeft === 0
        ? 'Tu prueba termina hoy'
        : daysLeft === 1
          ? '1 día de prueba gratis'
          : `${daysLeft} días de prueba gratis`}
    </div>
  )
}

export function SettingsClient({ business }: { business: BusinessData }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 page-enter motion-stagger">
      <BusinessSection business={business} />
      <PointsSection config={business.points_config} />
      <RedeemablesSection initialProducts={business.redeemable_products} />
    </div>
  )
}

// ─── Sección: Datos del negocio ───────────────────────────────────────────────

function BusinessSection({ business }: { business: BusinessData }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logo_url)
  const [form, setForm] = useState({
    name: business.name,
    phone: business.phone ?? '',
    address: business.address ?? '',
    email: business.email ?? '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateBusinessInfo(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        setSaved(true)
        toast.success('Datos actualizados.')
      }
    })
  }

  return (
    <section className="card-enter">
      {/* Encabezado de sección */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
          <Store className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base leading-none">Mi negocio</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Información que aparece en los tickets de tus clientes
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y overflow-hidden lift-hover">
        {/* Logo */}
        <LogoUpload
          currentUrl={logoUrl}
          businessName={form.name}
          onUploaded={(url) => setLogoUrl(url || null)}
        />

        {/* Nombre — campo principal, más prominente */}
        <div className="px-4 py-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Nombre del negocio
          </Label>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Café El Rincón"
            className="border-0 shadow-none px-0 text-base font-medium h-8 focus-visible:ring-0 mt-1"
          />
        </div>

        {/* Campos secundarios */}
        <FieldRow
          icon={<Phone className="h-4 w-4" />}
          label="Teléfono"
          value={form.phone}
          onChange={(v) => set('phone', v)}
          placeholder="5512345678"
          inputMode="numeric"
          optional
        />
        <FieldRow
          icon={<MapPin className="h-4 w-4" />}
          label="Dirección"
          value={form.address}
          onChange={(v) => set('address', v)}
          placeholder="Calle Reforma 123, CDMX"
          optional
        />
        <FieldRow
          icon={<Mail className="h-4 w-4" />}
          label="Email"
          value={form.email}
          onChange={(v) => set('email', v)}
          placeholder="hola@micafe.mx"
          inputMode="email"
          optional
          disabled={!!business.email}
          disabledHint="Contacta soporte para cambiar el email"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending || !form.name.trim()}
          size="sm"
          variant={saved ? 'outline' : 'default'}
          className="gap-2 min-w-[130px]"
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Guardado
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              {isPending ? 'Guardando...' : 'Guardar cambios'}
            </>
          )}
        </Button>
      </div>
    </section>
  )
}

function FieldRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  optional,
  disabled,
  disabledHint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  optional?: boolean
  disabled?: boolean
  disabledHint?: string
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 ${disabled ? 'opacity-60' : 'hover:bg-muted/40'}`}>
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {optional && !disabled && (
            <span className="text-xs text-muted-foreground/60">(opcional)</span>
          )}
          {disabled && disabledHint && (
            <span className="text-xs text-muted-foreground/50 italic">{disabledHint}</span>
          )}
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
          className="border-0 shadow-none px-0 h-7 text-sm focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-100"
        />
      </div>
    </div>
  )
}

// ─── Sección: Programa de puntos ──────────────────────────────────────────────

function PointsSection({ config }: { config: PointsConfig }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    earn_rate: String(config.earn_rate),
    earn_per_amount: String(config.earn_per_amount),
    redeem_value: String(config.redeem_value),
    min_redeem_points: String(config.min_redeem_points),
    welcome_bonus: String(config.welcome_bonus),
    expiry_days: String(config.expiry_days),
  })

  function set(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  const earnRate = parseFloat(form.earn_rate) || 1
  const earnPerAmount = parseFloat(form.earn_per_amount) || 100
  const redeemValue = parseFloat(form.redeem_value) || 1
  const minRedeem = parseInt(form.min_redeem_points) || 50
  const welcomeBonus = parseInt(form.welcome_bonus) || 0

  // Ejemplos calculados
  const exampleSpend = 500
  const examplePoints = Math.floor(exampleSpend / earnPerAmount) * earnRate
  const minDiscount = (minRedeem * redeemValue).toFixed(0)

  function handleSave() {
    startTransition(async () => {
      const result = await updatePointsConfig({
        earn_rate: earnRate,
        earn_per_amount: earnPerAmount,
        redeem_rate: config.redeem_rate,
        redeem_value: redeemValue,
        min_redeem_points: minRedeem,
        expiry_days: parseInt(form.expiry_days) || 365,
        welcome_bonus: welcomeBonus,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setSaved(true)
        toast.success('Configuración de puntos guardada.')
      }
    })
  }

  return (
    <section className="card-enter">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
          <Zap className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="font-semibold text-base leading-none">Programa de puntos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Las reglas aplican a todas las ventas nuevas
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Card: Acumulación */}
        <div className="rounded-xl border bg-card p-5 space-y-4 lift-hover">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Cómo se acumulan</span>
          </div>

          {/* Fórmula visual */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Por cada</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                value={form.earn_per_amount}
                onChange={(e) => set('earn_per_amount', e.target.value)}
                className="w-24 pl-6 h-9 text-center font-semibold"
                inputMode="numeric"
              />
            </div>
            <span className="text-sm text-muted-foreground">MXN gastados</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={form.earn_rate}
              onChange={(e) => set('earn_rate', e.target.value)}
              className="w-16 h-9 text-center font-semibold"
              inputMode="decimal"
            />
            <span className="text-sm text-muted-foreground">
              punto{earnRate !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Ejemplo calculado */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
            Ejemplo: compra de ${exampleSpend} MXN →{' '}
            <span className="font-semibold text-foreground">
              {examplePoints} punto{examplePoints !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Card: Canjeo */}
        <div className="rounded-xl border bg-card p-5 space-y-4 lift-hover">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium">Cómo se canjean</span>
          </div>

          <div className="space-y-3">
            {/* Valor de cada punto */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Cada punto vale</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  value={form.redeem_value}
                  onChange={(e) => set('redeem_value', e.target.value)}
                  className="w-20 pl-6 h-9 text-center font-semibold"
                  inputMode="decimal"
                />
              </div>
              <span className="text-sm text-muted-foreground">MXN de descuento</span>
            </div>

            {/* Mínimo para canjear */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Mínimo</span>
              <Input
                value={form.min_redeem_points}
                onChange={(e) => set('min_redeem_points', e.target.value)}
                className="w-20 h-9 text-center font-semibold"
                inputMode="numeric"
              />
              <span className="text-sm text-muted-foreground">puntos para canjear</span>
            </div>
          </div>

          {/* Ejemplo calculado */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Check className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            Con {minRedeem} puntos el cliente obtiene{' '}
            <span className="font-semibold text-foreground">${minDiscount} de descuento</span>
          </div>
        </div>

        {/* Card: Extras */}
        <div className="rounded-xl border bg-card divide-y overflow-hidden lift-hover">
          {/* Bono bienvenida */}
          <div className="flex items-center justify-between px-5 py-3.5 gap-4">
            <div className="flex items-start gap-3">
              <Gift className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Bono de bienvenida</p>
                <p className="text-xs text-muted-foreground">
                  Puntos gratis al registrarse por primera vez
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                value={form.welcome_bonus}
                onChange={(e) => set('welcome_bonus', e.target.value)}
                className="w-20 h-9 text-center font-semibold"
                inputMode="numeric"
              />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
          </div>

          <Separator />

          {/* Vigencia */}
          <div className="flex items-center justify-between px-5 py-3.5 gap-4">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Vigencia de puntos</p>
                <p className="text-xs text-muted-foreground">
                  Los puntos expiran después de este período
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                value={form.expiry_days}
                onChange={(e) => set('expiry_days', e.target.value)}
                className="w-20 h-9 text-center font-semibold"
                inputMode="numeric"
              />
              <span className="text-xs text-muted-foreground">días</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending}
          size="sm"
          variant={saved ? 'outline' : 'default'}
          className="gap-2 min-w-[160px]"
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Guardado
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              {isPending ? 'Guardando...' : 'Guardar configuración'}
            </>
          )}
        </Button>
      </div>
    </section>
  )
}
