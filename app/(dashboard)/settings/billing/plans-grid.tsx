"use client"

import { Check, CreditCard, Infinity, Sparkles, Users } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PLAN_DOT_COLOR, PLAN_ORDER } from '@/lib/plans'
import { createCheckoutSession, updateSubscription } from '@/actions/billing'

type BillingAccess = {
  isTrial: boolean
  daysLeft: number
  trialEndsAt: string | null
  planName: string | null
  planSlug: string | null
  planId: string | null
}

type PlanRow = {
  id: string
  slug: string
  name: string
  price_mxn: number
  max_customers: number | null
  features: unknown
}

function formatRelativeCost(plan: PlanRow) {
  if (!plan.max_customers || plan.max_customers <= 0) {
    return null
  }

  const perClient = (plan.price_mxn * 1.16) / plan.max_customers
  return perClient.toFixed(perClient < 10 ? 2 : 1)
}

export function PlansGrid({ access, plans }: { access: BillingAccess; plans: PlanRow[] }) {
  const router = useRouter()
  const [showRelativeCost, setShowRelativeCost] = useState(false)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const trialEnd = useMemo(() => {
    if (!access.trialEndsAt) return null
    return new Date(access.trialEndsAt).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [access.trialEndsAt])

  function handleChoosePlan(plan: PlanRow) {
    setPendingPlanId(plan.id)

    startTransition(async () => {
      // Si ya tiene suscripción (activa o en trial) → actualizar en Stripe directamente
      const hasExistingSubscription = Boolean(access.planId)

      if (hasExistingSubscription) {
        const updateResult = await updateSubscription(plan.slug)
        if (!updateResult.success) {
          toast.error(updateResult.error)
          setPendingPlanId(null)
          return
        }

        toast.success('Plan actualizado correctamente.')
        setPendingPlanId(null)
        router.refresh()
        return
      }

      // Sin suscripción → nuevo checkout
      const checkoutResult = await createCheckoutSession(plan.slug, {
        withTrial: true,
        source: 'settings',
      })

      if (!checkoutResult.success) {
        toast.error(checkoutResult.error)
        setPendingPlanId(null)
        return
      }

      const checkoutUrl = typeof checkoutResult.checkoutUrl === 'string' ? checkoutResult.checkoutUrl : null
      if (!checkoutUrl) {
        toast.error('No se pudo abrir Stripe Checkout.')
        setPendingPlanId(null)
        return
      }

      window.location.assign(checkoutUrl)
    })
  }

  return (
    <>
      {access.isTrial && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 space-y-0.5">
            <p className="font-semibold">Período de prueba activo</p>
            <p>
              Tienes acceso a todas las funciones.
              {access.daysLeft > 0
                ? ` Quedan ${access.daysLeft} día${access.daysLeft !== 1 ? 's' : ''} (hasta el ${trialEnd}).`
                : ' Tu prueba termina hoy.'}
            </p>
            <p className="text-amber-700">Al finalizar, solo podrás acceder a las funciones de tu plan seleccionado.</p>
          </div>
        </div>
      )}

      {access.planName && (
        <div className="rounded-xl border bg-card px-5 py-4 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted shrink-0">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plan actual</p>
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', PLAN_DOT_COLOR[access.planSlug ?? ''] ?? 'bg-muted-foreground')} />
              <p className="font-semibold">{access.planName}</p>
              {access.isTrial && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700">
                  Trial
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card/40 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Mostrar costo relativo por cliente</p>
          <p className="text-xs text-muted-foreground">Calculado como precio mensual dividido entre el máximo de clientes del plan.</p>
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

      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
        {plans.map((plan) => {
          const features: string[] = Array.isArray(plan.features) ? (plan.features as string[]) : []
          const isCurrent = plan.id === access.planId
          const isPopular = plan.slug === 'growth'
          const isGod = plan.slug === 'unlimited'
          const rank = PLAN_ORDER.indexOf(plan.slug as (typeof PLAN_ORDER)[number])
          const currentRank = PLAN_ORDER.indexOf((access.planSlug ?? '') as (typeof PLAN_ORDER)[number])
          const isUpgrade = rank > currentRank
          const isDowngrade = rank < currentRank

          const cardCls = isCurrent
            ? 'border-primary bg-primary/5 shadow-sm'
            : isPopular
              ? 'border-indigo-200 hover:border-indigo-300'
              : isGod
                ? 'border-amber-200 hover:border-amber-300'
                : 'border-border hover:border-primary/30'

          const relativeCost = formatRelativeCost(plan)

          return (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-2xl border-2 p-5 transition-all duration-200',
                cardCls
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-4">
                  <Badge className="text-[10px] px-2 py-0.5 bg-primary">
                    Plan actual
                  </Badge>
                </div>
              )}
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-4">
                  <Badge className="text-[10px] px-2 py-0.5 bg-indigo-600">
                    El más popular
                  </Badge>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', PLAN_DOT_COLOR[plan.slug] ?? 'bg-muted-foreground')} />
                    <h3 className="font-bold text-base">{plan.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {plan.max_customers ? (
                      <>
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Hasta {plan.max_customers} clientes</span>
                      </>
                    ) : (
                      <>
                        <Infinity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Clientes ilimitados</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 w-32">
                  {!showRelativeCost && (
                    <>
                      <div className="flex min-h-8 items-end justify-end gap-0.5">
                        <span className="text-xs text-muted-foreground">$</span>
                        <span className="text-2xl font-bold tabular-nums leading-none">{Math.round(plan.price_mxn * 1.16)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">MXN/mes + IVA</span>
                    </>
                  )}

                  {showRelativeCost && (
                    <>
                      {relativeCost ? (
                        <>
                          <div className="flex min-h-8 items-end justify-end gap-0.5">
                            <span className="text-xs text-muted-foreground">$</span>
                            <span className="text-2xl font-bold tabular-nums leading-none">{relativeCost}</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">MXN/cliente/mes</span>
                        </>
                      ) : (
                        <>
                          <div className="flex min-h-8 items-end justify-end">
                            <span className="text-2xl font-bold leading-none text-muted-foreground">∞</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Clientes ilimitados</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-xs text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="rounded-lg bg-primary/10 py-2 text-center text-xs font-medium text-primary">
                  Tu plan actual
                </div>
              ) : (
                <Button
                  className="w-full"
                  variant={isUpgrade ? 'default' : 'outline'}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isPending || pendingPlanId === plan.id}
                >
                  {pendingPlanId === plan.id
                    ? 'Procesando...'
                    : access.isTrial
                      ? 'Elegir plan con 7 días gratis'
                      : isUpgrade
                        ? 'Actualizar plan'
                        : isDowngrade
                          ? 'Cambiar plan'
                          : 'Elegir plan'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
