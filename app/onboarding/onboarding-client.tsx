'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ArrowRight, ArrowLeft, Users, Infinity, PartyPopper, Mail, Receipt, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LogoUpload } from '@/components/settings/logo-upload'
import { completeOnboarding } from '@/actions/onboarding'
import { createCheckoutSession, syncCheckoutSession } from '@/actions/billing'
import type { SubscriptionPlanRow } from '@/types/database'

const SLUG_NORMALIZE: Record<string, string> = {
  starter: 'basic', pro: 'growth', premium: 'unlimited',
  basic: 'basic', growth: 'growth', unlimited: 'unlimited',
}

const FACTURA_EMAIL = process.env.NEXT_PUBLIC_BILLING_EMAIL ?? 'victor.larapizana@outlook.com'

type Props = {
  businessId: string
  businessName: string
  plans: SubscriptionPlanRow[]
  checkoutStatus?: string
  checkoutSessionId?: string
}

const STEPS = ['Negocio', 'Puntos', 'Plan']

export function OnboardingClient({ businessName, plans, checkoutStatus, checkoutSessionId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showRelativeCost, setShowRelativeCost] = useState(false)
  const [syncingCheckout, setSyncingCheckout] = useState(Boolean(checkoutStatus === 'success' && checkoutSessionId))
  const [successData, setSuccessData] = useState<{ planSlug: string } | null>(null)

  useEffect(() => {
    if (checkoutStatus !== 'success' || !checkoutSessionId) return

    let mounted = true

    async function runSync() {
      const result = await syncCheckoutSession(checkoutSessionId!)
      if (!mounted) return

      if (!result.success) {
        setSyncingCheckout(false)
        toast.error(`No se pudo activar el plan: ${result.error}`)
        return
      }

      setSyncingCheckout(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSuccessData({ planSlug: (result as any).planSlug ?? '' })
    }

    runSync()

    return () => {
      mounted = false
    }
  }, [checkoutStatus, checkoutSessionId, router])

  useEffect(() => {
    if (checkoutStatus === 'cancelled') {
      toast.error('No se completó el pago. Debes finalizar Stripe para activar tu cuenta.')
    }
  }, [checkoutStatus])

  const [form, setForm] = useState({
    name: businessName,
    phone: '',
    address: '',
    earn_rate: '10',
    earn_per_amount: '1',
    redeem_value: '0.01',
    min_redeem_points: '100',
    welcome_bonus: '10',
    selectedPlan: '',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleFinish() {
    setSaving(true)
    const result = await completeOnboarding({
      name: form.name,
      phone: form.phone,
      address: form.address,
      planId: form.selectedPlan || undefined,
      pointsConfig: {
        earn_rate: parseFloat(form.earn_rate) || 1,
        earn_per_amount: parseFloat(form.earn_per_amount) || 100,
        redeem_rate: 1,
        redeem_value: parseFloat(form.redeem_value) || 1,
        min_redeem_points: parseInt(form.min_redeem_points) || 50,
        expiry_days: 365,
        welcome_bonus: parseInt(form.welcome_bonus) || 0,
      },
    })

    if (result?.error) {
      setSaving(false)
      toast.error(result.error)
      return
    }

    const checkout = await createCheckoutSession(form.selectedPlan, {
      withTrial: true,
      source: 'onboarding',
    })

    if (!checkout.success) {
      setSaving(false)
      toast.error(checkout.error)
      return
    }

    const checkoutUrl = typeof checkout.checkoutUrl === 'string' ? checkout.checkoutUrl : null
    if (!checkoutUrl) {
      setSaving(false)
      toast.error('No se pudo abrir Stripe Checkout.')
      return
    }

    toast.success('Te estamos llevando a Stripe...')
    window.location.assign(checkoutUrl)
  }

  if (successData) {
    return <SuccessScreen planSlug={successData.planSlug} plans={plans} onContinue={() => { router.replace('/dashboard'); router.refresh() }} />
  }

  return (
    <div className="space-y-8">
      {syncingCheckout && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Activando tu plan... Esto tarda unos segundos.
        </div>
      )}

      {checkoutStatus === 'cancelled' && !syncingCheckout && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout cancelado. Para continuar, debes elegir un plan y completar Stripe.
        </div>
      )}

      {/* ── Progress ── */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-white border-2 border-border text-muted-foreground'
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-xs font-medium hidden sm:block transition-colors ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-2 -mt-3.5 transition-colors duration-300"
                style={{ backgroundColor: i < step ? 'hsl(var(--primary))' : '#e5e7eb' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Negocio ── */}
      {step === 0 && (
        <div className="page-enter space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tu negocio</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Esta información aparece en los tickets de tus clientes.
            </p>
          </div>

          {/* Logo centrado */}
          <div className="flex justify-center py-2">
            <LogoUpload
              currentUrl={null}
              businessName={form.name}
              onUploaded={() => {}}
              variant="centered"
            />
          </div>

          {/* Campos */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Nombre del negocio</Label>
              <Input
                id="biz-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Café El Rincón"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="biz-phone">
                  Teléfono
                  <span className="text-muted-foreground text-xs ml-1">(opcional)</span>
                </Label>
                <Input
                  id="biz-phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="5512345678"
                  inputMode="numeric"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-address">
                  Dirección
                  <span className="text-muted-foreground text-xs ml-1">(opcional)</span>
                </Label>
                <Input
                  id="biz-address"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Calle Reforma 123"
                  className="h-11"
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full h-11 gap-2"
            onClick={() => setStep(1)}
            disabled={!form.name.trim()}
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Step 1: Puntos ── */}
      {step === 1 && (
        <div className="page-enter space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Programa de puntos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Puedes ajustar esto en cualquier momento desde Configuración.
            </p>
          </div>

          {/* Formula viva */}
          <div className="rounded-2xl bg-primary text-primary-foreground px-5 py-4 space-y-1">
            <p className="text-xs font-medium opacity-70 uppercase tracking-wide">Resumen</p>
            <p className="text-base font-medium leading-snug">
              Por cada <strong className="text-lg">${form.earn_per_amount || '100'}</strong> MXN gastados
              → el cliente gana <strong className="text-lg">{form.earn_rate || '1'}</strong> punto{parseFloat(form.earn_rate) !== 1 ? 's' : ''}
            </p>
            <p className="text-sm opacity-80">
              Cada punto vale <strong>${form.redeem_value || '1'} MXN</strong> de descuento
            </p>
          </div>

          {/* Campos en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Puntos por compra</Label>
              <Input value={form.earn_rate} onChange={(e) => update('earn_rate', e.target.value)} inputMode="numeric" placeholder="1" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Cada cuántos MXN</Label>
              <Input value={form.earn_per_amount} onChange={(e) => update('earn_per_amount', e.target.value)} inputMode="numeric" placeholder="100" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor del punto ($)</Label>
              <Input value={form.redeem_value} onChange={(e) => update('redeem_value', e.target.value)} inputMode="decimal" placeholder="1" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Mínimo para canjear</Label>
              <Input value={form.min_redeem_points} onChange={(e) => update('min_redeem_points', e.target.value)} inputMode="numeric" placeholder="50" className="h-11" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Bono de bienvenida
              <span className="text-muted-foreground text-xs ml-1">(puntos al registrarse)</span>
            </Label>
            <Input value={form.welcome_bonus} onChange={(e) => update('welcome_bonus', e.target.value)} inputMode="numeric" placeholder="10" className="h-11" />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="h-11 px-5 gap-2" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button className="flex-1 h-11 gap-2" onClick={() => setStep(2)}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Plan ── */}
      {step === 2 && (
        <div className="page-enter space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Elige tu plan</h1>
            <p className="text-muted-foreground text-sm mt-1">
              7 días gratis en cualquier plan. Capturamos tu tarjeta hoy y el cobro inicia al terminar el trial.
            </p>
          </div>

          <div className="rounded-xl border bg-card/40 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Mostrar costo relativo por cliente</p>
              <p className="text-xs text-muted-foreground">Precio mensual dividido entre el máximo de clientes de cada plan.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">Mensual</span>
              <Switch
                checked={showRelativeCost}
                onCheckedChange={setShowRelativeCost}
                aria-label="Alternar costo relativo por cliente"
              />
              <span className="text-xs text-muted-foreground">Por cliente</span>
            </div>
          </div>

          <div className="space-y-3">
            {(() => {
              const sorted = [...plans].sort((a, b) => a.price_mxn - b.price_mxn)
              return sorted.map((plan, idx) => {
              const features = Array.isArray(plan.features) ? plan.features as string[] : []
              const isSelected = form.selectedPlan === plan.id
              const isPopular = plan.slug === 'growth'
              const isGod = plan.slug === 'unlimited'
              const isStarter = plan.slug === 'starter'

              // Descuento vs el plan inmediatamente superior (no vs el máximo)
              const nextPlan = sorted[idx + 1]
              const discountPct = nextPlan && !isGod
                ? Math.round((1 - plan.price_mxn / nextPlan.price_mxn) * 100)
                : null

              // Clases según tipo de plan y estado
              const cardCls = isPopular
                ? isSelected
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-300/40 scale-[1.01]'
                  : 'border-indigo-300 bg-indigo-50 hover:border-indigo-400 hover:shadow-md'
                : isGod
                  ? isSelected
                    ? 'border-amber-400 bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-amber-950 shadow-2xl shadow-amber-400/50 scale-[1.01]'
                    : 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-sm'
                  : isStarter
                    ? isSelected
                      ? 'border-slate-400 bg-slate-700 text-white shadow-md scale-[1.01]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    : isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]'
                      : 'border-border bg-white hover:border-primary/40 hover:shadow-sm'

              const mutedText = isGod && isSelected
                ? 'text-amber-800'
                : isStarter && isSelected
                  ? 'text-slate-300'
                  : isSelected
                    ? 'opacity-75'
                    : isPopular
                      ? 'text-indigo-500'
                      : 'text-muted-foreground'

              const featureCls = isGod && isSelected
                ? 'bg-black/10 text-amber-950 font-semibold'
                : isStarter && isSelected
                  ? 'bg-white/15 text-slate-100'
                  : isSelected
                    ? 'bg-white/15 text-white'
                    : isPopular
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-muted text-muted-foreground'

              const relativeCost = plan.max_customers && plan.max_customers > 0
                ? (plan.price_mxn / plan.max_customers).toFixed(plan.price_mxn / plan.max_customers < 10 ? 2 : 1)
                : null

              return (
                <button
                  key={plan.id}
                  onClick={() => update('selectedPlan', plan.id)}
                  className={`group w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 ${cardCls}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-base">{plan.name}</span>
                        {isPopular && (
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}>
                            El más popular
                          </span>
                        )}
                        {discountPct && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            -{discountPct}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mb-3">
                        {plan.max_customers ? (
                          <><Users className={`h-3.5 w-3.5 ${mutedText}`} />
                          <span className={`text-sm ${mutedText}`}>
                            Hasta {plan.max_customers} clientes
                          </span></>
                        ) : (
                          <><Infinity className={`h-3.5 w-3.5 ${mutedText}`} />
                          <span className={`text-sm ${mutedText}`}>
                            Clientes ilimitados
                          </span></>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {features.map((f) => (
                          <span key={f} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${featureCls}`}>
                            <Check className="h-3 w-3" />
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Precio */}
                    <div className="text-right shrink-0 w-33">
                      {!showRelativeCost ? (
                        <>
                          <div className="flex items-center justify-end gap-1 mb-0.5">
                            <span className={`text-xs line-through ${mutedText}`}>${Math.round(plan.price_mxn * 1.16)} MXN</span>
                          </div>
                          <div className="flex min-h-9 items-end justify-end gap-0.5">
                            <span className={`text-3xl font-bold tracking-tight leading-none ${isSelected ? (isGod ? 'text-amber-950' : isStarter ? 'text-slate-100' : 'text-white') : ''}`}>
                              $0
                            </span>
                          </div>
                          <span className={`text-xs font-semibold whitespace-nowrap ${isSelected ? (isGod ? 'text-amber-800' : isStarter ? 'text-slate-300' : 'text-green-300') : (isPopular ? 'text-indigo-500' : 'text-green-600')}`}>
                            7 días gratis!
                          </span>
                        </>
                      ) : relativeCost ? (
                        <>
                          <div className="flex min-h-9 items-end justify-end gap-0.5">
                            <span className={`text-xs font-medium ${mutedText}`}>$</span>
                            <span className={`text-3xl font-bold tracking-tight leading-none ${isGod && isSelected ? 'text-amber-950' : ''}`}>
                              {relativeCost}
                            </span>
                          </div>
                          <span className={`text-xs whitespace-nowrap ${mutedText}`}>MXN/cliente/mes</span>
                        </>
                      ) : (
                        <>
                          <div className="flex min-h-9 items-end justify-end">
                            <span className={`text-3xl font-bold leading-none ${isGod && isSelected ? 'text-amber-950' : mutedText}`}>∞</span>
                          </div>
                          <span className={`block text-xs whitespace-nowrap ${mutedText}`}>Clientes ilimitados</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })})()}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="h-11 px-5" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              className="flex-1 h-11 gap-2"
              onClick={handleFinish}
              disabled={saving || !form.selectedPlan}
            >
              {saving ? 'Redirigiendo a Stripe...' : !form.selectedPlan ? 'Selecciona un plan' : 'Continuar al checkout'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground pb-2">
            Stripe te mostrará claramente los 7 días gratis antes de confirmar el método de pago.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Success Screen ────────────────────────────────────────────────
function SuccessScreen({ planSlug, plans, onContinue }: {
  planSlug: string
  plans: SubscriptionPlanRow[]
  onContinue: () => void
}) {
  const plan = plans.find(p => (SLUG_NORMALIZE[p.slug] ?? p.slug) === planSlug) ?? plans[0]
  const totalConIva = Math.round((plan?.price_mxn ?? 0) * 1.16)

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)
  const trialEndStr = trialEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const nextBilling = new Date(trialEnd)
  const nextBillingStr = nextBilling.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 } })
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.1, y: 0.5 } }), 300)
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.9, y: 0.5 } }), 500)
    })
  }, [])

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <PartyPopper className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">¡Felicidades!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tu negocio está listo. Tu prueba gratuita ya comenzó.
          </p>
        </div>
      </div>

      {/* Resumen de orden */}
      <div className="rounded-xl border bg-white divide-y text-sm">
        <div className="px-4 py-3 flex items-center gap-2 font-semibold">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Resumen de tu suscripción
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{plan?.name ?? planSlug}</span>
        </div>
        <div className="px-4 py-3 flex justify-between font-semibold">
          <span>Total mensual</span>
          <div className="text-right">
            <span>${totalConIva.toLocaleString('es-MX')} MXN</span>
            <span className="block text-xs font-normal text-muted-foreground">IVA incluido</span>
          </div>
        </div>
      </div>

      {/* Fechas de cobro */}
      <div className="rounded-xl border bg-white divide-y text-sm">
        <div className="px-4 py-3 flex items-center gap-2 font-semibold">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Calendario de cobros
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-muted-foreground">Prueba gratis hasta</span>
          <span className="font-medium text-green-700">{trialEndStr}</span>
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-muted-foreground">Primer cobro</span>
          <span className="font-medium">{nextBillingStr}</span>
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-muted-foreground">Frecuencia</span>
          <span className="font-medium">Mensual</span>
        </div>
      </div>

      {/* Factura */}
      <div className="rounded-xl border bg-white text-sm">
        <div className="px-4 py-3 flex items-center gap-2 font-semibold border-b">
          <Mail className="h-4 w-4 text-muted-foreground" />
          ¿Necesitas factura (CFDI)?
        </div>
        <div className="px-4 py-4 space-y-2">
          <p className="text-muted-foreground">
            Escríbenos a{' '}
            <a href={`mailto:${FACTURA_EMAIL}`} className="font-medium text-primary underline underline-offset-2">
              {FACTURA_EMAIL}
            </a>{' '}
            con los siguientes datos:
          </p>
          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
            <li>RFC</li>
            <li>Razón social</li>
            <li>Dirección fiscal completa (incluyendo código postal)</li>
            <li>Uso de CFDI (ej. G03 – Gastos en general)</li>
            <li>Régimen fiscal</li>
            <li>Correo electrónico para recibir la factura</li>
          </ul>
        </div>
      </div>

      <Button className="w-full h-12 text-base gap-2" onClick={onContinue}>
        Ir al dashboard <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
