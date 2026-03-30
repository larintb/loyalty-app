'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { calculateRedemptionValue, maxRedeemablePoints } from '@/lib/points/calculator'
import type { PointsConfig } from '@/types/database'

type Props = {
  currentPoints: number
  subtotal: number
  config: PointsConfig
  onRedemptionChange: (pointsToRedeem: number, discount: number) => void
  tone?: 'default' | 'dark'
}

export function PointsDisplay({ currentPoints, subtotal, config, onRedemptionChange, tone = 'default' }: Props) {
  const [redeeming, setRedeeming] = useState(false)
  const [pointsInput, setPointsInput] = useState('')
  const isDark = tone === 'dark'

  const maxPoints = maxRedeemablePoints(subtotal, currentPoints, config)
  const pointsToRedeem = Math.min(parseInt(pointsInput) || 0, maxPoints)
  const discount = calculateRedemptionValue(pointsToRedeem, config)

  function handleToggle(checked: boolean) {
    setRedeeming(checked)
    if (!checked) {
      setPointsInput('')
      onRedemptionChange(0, 0)
    } else {
      setPointsInput(String(maxPoints))
      onRedemptionChange(maxPoints, calculateRedemptionValue(maxPoints, config))
    }
  }

  function handlePointsChange(value: string) {
    const digits = value.replace(/\D/g, '')
    const num = parseInt(digits) || 0
    const clamped = Math.min(num, maxPoints)
    setPointsInput(clamped === 0 ? '' : String(clamped))
    onRedemptionChange(clamped, calculateRedemptionValue(clamped, config))
  }

  if (currentPoints === 0 || maxPoints === 0) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${
        isDark ? 'border-white/20 text-white/50' : 'text-muted-foreground'
      }`}>
        El cliente no tiene puntos canjeables en esta compra.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-semibold ${isDark ? 'text-white' : ''}`}>
            Canjear puntos
          </span>
          <Badge
            variant="secondary"
            className={`text-xs ${isDark ? 'bg-white/15 text-white border-transparent' : ''}`}
          >
            ⭐ {currentPoints} disponibles
          </Badge>
        </div>
        <Switch
          checked={redeeming}
          onCheckedChange={handleToggle}
          className={isDark ? 'data-[state=unchecked]:bg-white/20' : ''}
        />
      </div>

      {/* Detalle del canje */}
      {redeeming && (
        <div className={`rounded-lg border px-4 py-3 space-y-3 ${
          isDark ? 'border-white/20 bg-white/5' : 'bg-muted/30'
        }`}>
          {/* Input de puntos */}
          <div className="flex items-center gap-3">
            <span className={`text-sm shrink-0 ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
              Puntos a canjear
            </span>
            <Input
              value={pointsInput}
              onChange={(e) => handlePointsChange(e.target.value)}
              inputMode="numeric"
              placeholder={String(maxPoints)}
              className={`w-24 text-center font-mono font-semibold ${
                isDark
                  ? 'bg-white text-black border-white placeholder:text-black/40'
                  : ''
              }`}
            />
            <span className={`text-xs shrink-0 ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>
              máx. {maxPoints}
            </span>
          </div>

          {/* Resumen matemático */}
          <div className={`space-y-1.5 text-sm pt-1 border-t ${isDark ? 'border-white/10' : 'border-border'}`}>
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-muted-foreground'}>Puntos seleccionados</span>
              <span className={`font-medium ${isDark ? 'text-white' : ''}`}>{pointsToRedeem} pts</span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-muted-foreground'}>Descuento en compra</span>
              <span className="font-bold text-green-400">
                −${discount.toFixed(2)} MXN
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-muted-foreground'}>Total a pagar</span>
              <span className={`font-bold text-base ${isDark ? 'text-white' : ''}`}>
                ${Math.max(0, subtotal - discount).toFixed(2)} MXN
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
