'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
      // Por defecto canjear el máximo
      setPointsInput(String(maxPoints))
      onRedemptionChange(maxPoints, calculateRedemptionValue(maxPoints, config))
    }
  }

  function handlePointsChange(value: string) {
    const num = parseInt(value) || 0
    const clamped = Math.min(num, maxPoints)
    setPointsInput(String(clamped))
    onRedemptionChange(clamped, calculateRedemptionValue(clamped, config))
  }

  if (currentPoints === 0) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${
        isDark
          ? 'border-white/20 text-white/70'
          : 'text-muted-foreground'
      }`}>
        El cliente no tiene puntos acumulados aún.
      </div>
    )
  }

  return (
    <div className={`rounded-lg border px-4 py-3 space-y-3 ${isDark ? 'border-white/20 text-white' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Canjear puntos</span>
          <Badge variant="secondary" className={isDark ? 'bg-white/20 text-white border-transparent' : ''}>
            ⭐ {currentPoints} disponibles
          </Badge>
        </div>
        <Switch checked={redeeming} onCheckedChange={handleToggle} />
      </div>

      {redeeming && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <Label className={`text-sm w-28 shrink-0 ${isDark ? 'text-white/75' : 'text-muted-foreground'}`}>
              Puntos a canjear
            </Label>
            <Input
              value={pointsInput}
              onChange={(e) => handlePointsChange(e.target.value)}
              inputMode="numeric"
              className={`w-24 text-center ${
                isDark
                  ? 'bg-white text-black border-white placeholder:text-black/50'
                  : ''
              }`}
            />
            <span className={`text-sm ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
              máx. {maxPoints}
            </span>
          </div>
          {discount > 0 && (
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
              Descuento: -${discount.toFixed(2)} MXN
            </p>
          )}
        </div>
      )}
    </div>
  )
}
