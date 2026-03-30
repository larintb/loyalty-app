import Link from 'next/link'
import { Sparkles, Lock } from 'lucide-react'

/**
 * Shown during trial when the feature requires a higher plan than the one selected.
 * User still has access — this is purely informational.
 */
export function PlanBanner({
  featureLabel,
  requiredPlanName,
  daysLeft,
}: {
  featureLabel: string
  requiredPlanName: string
  daysLeft: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
      <p className="flex-1 text-amber-800 leading-snug">
        <span className="font-semibold">Período de prueba</span>
        {' — '}
        <span className="font-medium">{featureLabel}</span> está incluido desde el plan{' '}
        <span className="font-semibold">{requiredPlanName}</span>.
        {daysLeft > 0 && (
          <span className="text-amber-600">
            {' '}Quedan {daysLeft} día{daysLeft !== 1 ? 's' : ''} de prueba.
          </span>
        )}
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-amber-300 bg-white px-2.5 text-[0.8rem] font-medium text-amber-800 transition-all hover:border-amber-400 hover:bg-amber-100"
      >
        Ver planes
      </Link>
    </div>
  )
}

/**
 * Shown when the user is on an active paid plan that does NOT include the feature.
 * Replaces the page content entirely.
 */
export function UpgradeWall({
  featureLabel,
  currentPlanName,
  requiredPlanName,
}: {
  featureLabel: string
  currentPlanName: string | null
  requiredPlanName: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-5 page-enter">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h2 className="text-lg font-semibold leading-snug">
          {currentPlanName
            ? `Tu plan ${currentPlanName} no incluye ${featureLabel}`
            : `${featureLabel} no está disponible en tu plan`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Esta función está disponible desde el plan{' '}
          <span className="font-medium text-foreground">{requiredPlanName}</span>.
        </p>
      </div>
      <Link
        href="/settings/billing"
        className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
      >
        Ver planes y actualizar
      </Link>
    </div>
  )
}
