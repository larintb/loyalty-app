'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, RotateCcw, MessageCircle, Check, Loader2 } from 'lucide-react'
import { PhoneSearch } from '@/components/pos/phone-search'
import { PointsDisplay } from '@/components/pos/points-display'
import { RegisterModal } from '@/components/pos/register-modal'
import { RedeemablesButtons } from '@/components/pos/redeemables-buttons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createSale, sendWhatsAppTicket } from '@/actions/transactions'
import { searchCustomerByPhone } from '@/actions/customers'
import { calculateEarnedPoints } from '@/lib/points/calculator'
import type { PointsConfig, RedeemableProductRow } from '@/types/database'

type CustomerPreview = {
  id: string
  name: string
  phone: string
  total_points: number
  visit_count: number
  last_visit_at: string | null
}

type SaleSuccess = {
  transactionId: string
  ticketNumber: string
  customerName: string | null
  customerPhone: string | null
  total: number
  discountByPoints: number
  pointsEarned: number
  pointsRedeemed: number
  newBalance: number
}

export function POSClient({ 
  pointsConfig, 
  redeemableProducts = [] 
}: { 
  pointsConfig: PointsConfig
  redeemableProducts?: RedeemableProductRow[]
}) {
  const [customer, setCustomer] = useState<CustomerPreview | null>(null)
  const [totalInput, setTotalInput] = useState('')
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [discountByPoints, setDiscountByPoints] = useState(0)
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1)
  const [registerPhone, setRegisterPhone] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [saleResult, setSaleResult] = useState<SaleSuccess | null>(null)
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)
  const totalRef = useRef<HTMLInputElement>(null)

  const rawTotal = parseFloat(totalInput) || 0
  const finalTotal = Math.max(0, rawTotal - discountByPoints)
  const basePointsEarned = customer ? calculateEarnedPoints(finalTotal, pointsConfig) : 0
  const pointsEarned = basePointsEarned * multiplier

  function normalizeAmountInput(value: string) {
    const withDot = value.replace(/,/g, '.')
    const sanitized = withDot.replace(/[^\d.]/g, '')
    const [intPart = '', ...decimals] = sanitized.split('.')
    const decimalPart = decimals.join('')
    if (!decimals.length) return intPart
    return `${intPart}.${decimalPart}`
  }

  async function handleSale() {
    if (rawTotal <= 0) {
      toast.error('Ingresa el total del ticket.')
      totalRef.current?.focus()
      return
    }

    setProcessing(true)
    const result = await createSale({
      customerId: customer?.id ?? null,
      total: rawTotal,
      pointsToRedeem,
      pointsMultiplier: multiplier,
    })
    setProcessing(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setSaleResult({
      transactionId: result.transactionId,
      ticketNumber: result.ticketNumber,
      customerName: result.customerName,
      customerPhone: customer?.phone ?? null,
      total: result.total,
      discountByPoints: result.discountByPoints,
      pointsEarned: result.pointsEarned,
      pointsRedeemed: result.pointsRedeemed,
      newBalance: result.newBalance,
    })
  }

  async function handleRegistered() {
    const found = await searchCustomerByPhone(registerPhone)
    if (found) {
      setCustomer(found)
      // Foco al campo total después de registrar
      setTimeout(() => totalRef.current?.focus(), 100)
    }
    setShowRegister(false)
  }

  async function handleSendWhatsApp() {
    if (!saleResult?.customerPhone || !saleResult.customerName) return
    setWaSending(true)
    const result = await sendWhatsAppTicket({
      transactionId: saleResult.transactionId,
      customerPhone: saleResult.customerPhone,
      customerName: saleResult.customerName,
      ticketNumber: saleResult.ticketNumber,
      total: saleResult.total,
      discountByPoints: saleResult.discountByPoints,
      pointsEarned: saleResult.pointsEarned,
      pointsBalance: saleResult.newBalance,
    })
    setWaSending(false)
    if (result.success) {
      setWaSent(true)
    } else {
      toast.error(result.error ?? 'No se pudo enviar el WhatsApp.')
    }
  }

  function resetPOS() {
    setCustomer(null)
    setTotalInput('')
    setPointsToRedeem(0)
    setDiscountByPoints(0)
    setMultiplier(1)
    setSaleResult(null)
    setWaSent(false)
  }

  // ── Pantalla de confirmación ──────────────────────────────────────────────
  if (saleResult) {
    return (
      <div className="mt-3 min-h-[calc(100svh-14rem)] w-full page-enter flex items-center">
        <div className="relative w-full overflow-hidden rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 px-4 py-6 shadow-lg shadow-emerald-900/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
          <Card className="relative mx-auto max-w-md border-white/20 bg-white/92 backdrop-blur-sm card-enter">
            <CardContent className="space-y-4 pb-6 pt-8 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600 success-check-pop" />
              <div>
                <h2 className="text-2xl font-bold text-emerald-900">Orden confirmada</h2>
                <p className="text-sm text-emerald-800/80">#{saleResult.ticketNumber}</p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4 space-y-2 text-left text-sm">
              {saleResult.customerName && (
                <div className="flex justify-between">
                  <span className="text-emerald-900/70">Cliente</span>
                  <span className="font-medium text-emerald-950">{saleResult.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-base">
                <span className="text-emerald-900/70">Total</span>
                <span className="font-bold text-emerald-950">${saleResult.total.toFixed(2)}</span>
              </div>
              {saleResult.pointsRedeemed > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-900/70">Puntos canjeados</span>
                  <span className="text-orange-500">−{saleResult.pointsRedeemed} pts</span>
                </div>
              )}
              {saleResult.pointsEarned > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-900/70">Puntos ganados</span>
                  <span className="text-green-600 font-semibold">+{saleResult.pointsEarned} pts</span>
                </div>
              )}
              {saleResult.customerName && (
                <>
                  <Separator />
                  <div className="flex justify-between font-semibold text-emerald-900">
                    <span>Saldo actual</span>
                    <span>⭐ {saleResult.newBalance} pts</span>
                  </div>
                </>
              )}
              </div>

              {/* Botón WhatsApp (solo si hay cliente con teléfono) */}
              {saleResult.customerPhone && saleResult.customerName && (
                <Button
                  variant="outline"
                  className="w-full gap-2 transition-all duration-300"
                  size="lg"
                  onClick={handleSendWhatsApp}
                  disabled={waSending || waSent}
                >
                  {waSent ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Mensaje enviado</span>
                    </>
                  ) : waSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      Enviar por WhatsApp
                    </>
                  )}
                </Button>
              )}

              <Button onClick={resetPOS} className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800" size="lg">
                <RotateCcw className="h-4 w-4" />
                Nueva venta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── POS principal ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-4 page-enter motion-stagger">

      {/* 1. Buscar cliente */}
      <Card className="lift-hover bg-black text-white border-black">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">1. Cliente (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <PhoneSearch
            tone="dark"
            onCustomerFound={(c) => {
              setCustomer(c)
              setTimeout(() => totalRef.current?.focus(), 100)
            }}
            onCustomerCleared={() => {
              setCustomer(null)
              setPointsToRedeem(0)
              setDiscountByPoints(0)
            }}
            onRegisterNew={(phone) => {
              setRegisterPhone(phone)
              setShowRegister(true)
            }}
          />
        </CardContent>
      </Card>

      {/* 2. Total del ticket */}
      <Card className="lift-hover bg-black text-white border-black">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">2. Total del ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 font-medium">
              $
            </span>
            <Input
              ref={totalRef}
              value={totalInput}
              onChange={(e) => setTotalInput(normalizeAmountInput(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleSale()}
              placeholder="0.00"
              className="pl-7 text-2xl h-14 font-mono font-semibold bg-white text-black placeholder:text-black/50 border-white"
              inputMode="decimal"
            />
          </div>

          {/* Multiplicador de puntos (solo si hay cliente) */}
          {customer && (
            <div className="space-y-1.5">
              <p className="text-xs text-white/70 text-center">Puntos bonus</p>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMultiplier(m)}
                    className={`py-1.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
                      multiplier === m
                        ? m === 1
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'border-white/20 text-white/80 hover:border-white/50'
                    }`}
                  >
                    {m === 1 ? 'x1' : m === 2 ? '⭐ x2' : '🌟 x3'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview de puntos que va a ganar */}
          {rawTotal > 0 && customer && pointsEarned > 0 && (
            <p className="text-sm text-center text-white/80">
              El cliente ganará{' '}
              <span className={`font-semibold ${multiplier > 1 ? 'text-yellow-400' : 'text-white'}`}>
                +{pointsEarned} punto{pointsEarned !== 1 ? 's' : ''}
              </span>
              {multiplier > 1 && (
                <span className="text-xs ml-1 text-white/70">(x{multiplier} bonus)</span>
              )}
            </p>
          )}
          {rawTotal > 0 && !customer && (
            <p className="text-xs text-center text-white/70">
              Venta sin cliente — no acumula puntos
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Canjear puntos (solo si hay cliente con puntos) */}
      {customer && customer.total_points > 0 && rawTotal > 0 && (
        <Card className="lift-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Canjear puntos</CardTitle>
          </CardHeader>
          <CardContent>
            <PointsDisplay
              tone="dark"
              currentPoints={customer.total_points}
              subtotal={rawTotal}
              config={pointsConfig}
              onRedemptionChange={(pts, disc) => {
                setPointsToRedeem(pts)
                setDiscountByPoints(disc)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* 4. Productos canjeables */}
      {customer && redeemableProducts.length > 0 && (
        <Card className="lift-hover border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">4. Productos canjeables</CardTitle>
          </CardHeader>
          <CardContent>
            <RedeemablesButtons 
              products={redeemableProducts} 
              customerPoints={customer.total_points} 
              customerId={customer.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Resumen y cobrar */}
      <Card className="lift-hover bg-black text-white border-black">
        <CardContent className="pt-4 space-y-3">
          {discountByPoints > 0 && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-white/75">
                <span>Ticket</span>
                <span>${rawTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-400">
                <span>Descuento puntos</span>
                <span>−${discountByPoints.toFixed(2)}</span>
              </div>
              <Separator />
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total a cobrar</span>
            <span>${finalTotal.toFixed(2)}</span>
          </div>
          <Button
            className="w-full h-12 text-base bg-white text-black hover:bg-white/90"
            onClick={handleSale}
            disabled={processing || rawTotal <= 0}
          >
            {processing ? 'Registrando...' : `Registrar $${finalTotal.toFixed(2)}`}
          </Button>
        </CardContent>
      </Card>

      <RegisterModal
        open={showRegister}
        defaultPhone={registerPhone}
        onClose={() => setShowRegister(false)}
        onRegistered={handleRegistered}
      />
    </div>
  )
}
