import type { PointsConfig } from '@/types/database'

/**
 * Calcula los puntos que gana un cliente por una compra.
 * Regla: por cada `earn_per_amount` MXN gastados, gana `earn_rate` puntos.
 *
 * Ejemplo config: earn_rate=1, earn_per_amount=100
 *   $250 → floor(250/100) * 1 = 2 puntos
 */
export function calculateEarnedPoints(
  amount: number,
  config: PointsConfig
): number {
  if (amount <= 0 || config.earn_per_amount <= 0) return 0
  return Math.floor(amount / config.earn_per_amount) * config.earn_rate
}

/**
 * Calcula el descuento en MXN al canjear puntos.
 * Regla: cada `redeem_rate` puntos vale `redeem_value` MXN.
 *
 * Ejemplo config: redeem_rate=1, redeem_value=1
 *   50 puntos → 50 * (1/1) = $50 MXN de descuento
 */
export function calculateRedemptionValue(
  points: number,
  config: PointsConfig
): number {
  if (points <= 0 || config.redeem_rate <= 0) return 0
  return (points / config.redeem_rate) * config.redeem_value
}

/**
 * Valida si un cliente puede canjear la cantidad solicitada de puntos.
 */
export function canRedeem(
  pointsToRedeem: number,
  currentBalance: number,
  config: PointsConfig
): { allowed: boolean; reason?: string } {
  if (pointsToRedeem <= 0) {
    return { allowed: false, reason: 'Cantidad inválida.' }
  }
  if (pointsToRedeem > currentBalance) {
    return { allowed: false, reason: 'Saldo de puntos insuficiente.' }
  }
  if (pointsToRedeem < config.min_redeem_points) {
    return {
      allowed: false,
      reason: `Mínimo ${config.min_redeem_points} puntos para canjear.`,
    }
  }
  return { allowed: true }
}

/**
 * Calcula el máximo de puntos que el cliente puede canjear
 * sin que el descuento supere el total de la compra.
 */
export function maxRedeemablePoints(
  total: number,
  currentBalance: number,
  config: PointsConfig
): number {
  if (config.redeem_value <= 0) return 0
  // Máximo por balance
  const byBalance = currentBalance
  // Máximo por monto de compra (no puede descontar más de lo que cuesta)
  const byAmount = Math.floor((total / config.redeem_value) * config.redeem_rate)
  return Math.min(byBalance, byAmount)
}
