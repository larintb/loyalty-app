'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, Store, Star, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { completeOnboarding } from '@/actions/onboarding'
import type { SubscriptionPlanRow } from '@/types/database'

type Props = {
  businessId: string
  businessName: string
  plans: SubscriptionPlanRow[]
}

const STEPS = [
  { id: 1, label: 'Tu negocio', icon: Store },
  { id: 2, label: 'Puntos', icon: Star },
  { id: 3, label: 'Plan', icon: CreditCard },
]

export function OnboardingClient({ businessId, businessName, plans }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: businessName,
    phone: '',
    address: '',
    earn_rate: '1',
    earn_per_amount: '100',
    redeem_value: '1',
    min_redeem_points: '50',
    welcome_bonus: '10',
    selectedPlan: '',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleFinish() {
    setSaving(true)
    const result = await completeOnboarding({
      businessId,
      name: form.name,
      phone: form.phone,
      address: form.address,
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
    setSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }

    toast.success('¡Negocio configurado! Ya puedes empezar.')
    router.push('/pos')
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === s.id
                  ? 'bg-primary text-primary-foreground'
                  : step > s.id
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.id ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Datos del negocio */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos de tu negocio</CardTitle>
            <CardDescription>Así aparecerá en los tickets de tus clientes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del negocio</Label>
              <Input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Café El Rincón"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="5512345678"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Calle Reforma 123, CDMX"
              />
            </div>
            <Button className="w-full" onClick={() => setStep(2)} disabled={!form.name.trim()}>
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Config de puntos */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Configura tus puntos</CardTitle>
            <CardDescription>
              Puedes cambiar esto después desde Configuración.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Preview */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-center">
              Por cada{' '}
              <strong>${form.earn_per_amount || '100'} MXN</strong>{' '}
              gastados, el cliente gana{' '}
              <strong>{form.earn_rate || '1'} punto</strong>.
              <br />
              Cada punto vale{' '}
              <strong>${form.redeem_value || '1'} MXN</strong> de descuento.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Puntos por compra</Label>
                <Input
                  value={form.earn_rate}
                  onChange={(e) => update('earn_rate', e.target.value)}
                  inputMode="numeric"
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Cada cuántos MXN</Label>
                <Input
                  value={form.earn_per_amount}
                  onChange={(e) => update('earn_per_amount', e.target.value)}
                  inputMode="numeric"
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor de cada punto ($)</Label>
                <Input
                  value={form.redeem_value}
                  onChange={(e) => update('redeem_value', e.target.value)}
                  inputMode="decimal"
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Puntos mínimos para canjear</Label>
                <Input
                  value={form.min_redeem_points}
                  onChange={(e) => update('min_redeem_points', e.target.value)}
                  inputMode="numeric"
                  placeholder="50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Bono de bienvenida (puntos){' '}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                value={form.welcome_bonus}
                onChange={(e) => update('welcome_bonus', e.target.value)}
                inputMode="numeric"
                placeholder="10"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Selección de plan */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Elige tu plan</CardTitle>
            <CardDescription>
              14 días de prueba gratis. Cancela cuando quieras.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {plans.map((plan) => {
                const features = Array.isArray(plan.features) ? plan.features as string[] : []
                const isSelected = form.selectedPlan === plan.id
                return (
                  <button
                    key={plan.id}
                    onClick={() => update('selectedPlan', plan.id)}
                    className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{plan.name}</span>
                      <div className="flex items-center gap-2">
                        {plan.slug === 'growth' && (
                          <Badge variant="secondary">Popular</Badge>
                        )}
                        <span className="font-bold">
                          ${plan.price_mxn.toFixed(0)}{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            /mes
                          </span>
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {plan.max_customers
                        ? `Hasta ${plan.max_customers} clientes`
                        : 'Clientes ilimitados'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {features.map((f: string) => (
                        <span
                          key={f}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                className="flex-1"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? 'Guardando...' : '¡Empezar gratis!'}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Puedes elegir plan después. Tus 14 días de prueba empiezan hoy.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
