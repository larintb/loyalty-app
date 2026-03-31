'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { registerCustomer } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'

type Props = {
  open: boolean
  defaultPhone: string
  onClose: () => void
  onRegistered: (customerId: string) => void
}

export function RegisterModal({ open, defaultPhone, onClose, onRegistered }: Props) {
  const privacyPdfUrl = '/terms'
  const termsPdfUrl = '/terms'

  const [phone, setPhone] = useState(defaultPhone)
  const [acceptRewards, setAcceptRewards] = useState(false)
  const [acceptLegal, setAcceptLegal] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [localError, setLocalError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setPhone(defaultPhone)
    setAcceptRewards(false)
    setAcceptLegal(false)
    setSignatureDataUrl('')
    setHasInk(false)
    setLocalError('')
  }, [open, defaultPhone])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ratio = Math.max(1, window.devicePixelRatio || 1)
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)

      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(ratio, ratio)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2
      ctx.strokeStyle = '#111827'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [open])

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.setPointerCapture(e.pointerId)
    const p = getPoint(e)
    isDrawingRef.current = true
    lastPointRef.current = p

    ctx.beginPath()
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#111827'
    ctx.fill()
    setHasInk(true)
    setLocalError('')
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const p = getPoint(e)
    const last = lastPointRef.current ?? p

    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()

    lastPointRef.current = p
    setHasInk(true)
    setLocalError('')
  }

  function endDraw(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (e && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId)
      } catch {
        // no-op
      }
    }

    isDrawingRef.current = false
    lastPointRef.current = null

    if (hasInk && canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    setHasInk(false)
    setSignatureDataUrl('')
    setLocalError('')
  }

  const [state, action, pending] = useActionState(
    async (prev: { error?: string; customerId?: string } | null, formData: FormData) => {
      const result = await registerCustomer(prev, formData)
      if (result?.customerId) {
        onRegistered(result.customerId)
        onClose()
      }
      return result
    },
    null
  )

  const canSubmit = acceptRewards && acceptLegal && !!signatureDataUrl

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* sm:max-w-2xl para tableta landscape: dos columnas side-by-side */}
      <DialogContent className="max-h-[95svh] overflow-y-auto sm:max-w-2xl sm:overflow-visible">
        <DialogHeader>
          <DialogTitle>Registrar nuevo cliente</DialogTitle>
          <DialogDescription>
            El cliente acumulará puntos desde esta venta. También recibirá un WhatsApp de bienvenida con sus puntos y, si existen, el teléfono y dirección del negocio.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="mt-2">
          {/* En sm+: dos columnas. En mobile: columna única */}
          <div className="sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-0 space-y-4 sm:space-y-0">

            {/* ── COLUMNA IZQUIERDA: campos del formulario ── */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" placeholder="Juan Pérez" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="tel"
                  placeholder="5512345678"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Correo <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Input id="email" name="email" type="email" placeholder="juan@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthday">
                  Cumpleaños <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Input id="birthday" name="birthday" type="date" />
              </div>

              {/* Consentimiento */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-medium">Consentimiento</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="accepted_rewards_program"
                    checked={acceptRewards}
                    onChange={(e) => setAcceptRewards(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Acepta inscribirse al sistema de recompensas.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="accepted_legal_terms"
                    checked={acceptLegal}
                    onChange={(e) => setAcceptLegal(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Acepta{' '}
                    <a
                      href={privacyPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 text-primary"
                    >
                      aviso de privacidad
                    </a>
                    {' '}y{' '}
                    <a
                      href={termsPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 text-primary"
                    >
                      términos y condiciones
                    </a>
                    .
                  </span>
                </label>
              </div>

              {localError && <FormError message={localError} />}
              {state?.error && <FormError message={state.error} />}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={pending || !canSubmit}
                  title={!canSubmit ? 'Completa consentimientos y firma para registrar.' : undefined}
                >
                  {pending ? 'Registrando...' : 'Registrar cliente'}
                </Button>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: firma ── */}
            <div className="space-y-2 sm:flex sm:flex-col">
              <Label className="text-sm font-medium">Firma del cliente</Label>
              <div className="rounded-md border bg-white p-2 flex-1 sm:min-h-0">
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 sm:h-full touch-none rounded border block"
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerCancel={endDraw}
                  onPointerLeave={endDraw}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                  Limpiar firma
                </Button>
                {!!signatureDataUrl && (
                  <p className="text-xs text-emerald-700">✓ Firma capturada</p>
                )}
              </div>
            </div>

          </div>

          <input type="hidden" name="signature_data_url" value={signatureDataUrl} readOnly />
        </form>
      </DialogContent>
    </Dialog>
  )
}
