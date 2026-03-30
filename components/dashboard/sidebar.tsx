'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  TrendingUp,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  CreditCard,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { logout } from '@/actions/auth'
import { PLAN_DOT_COLOR } from '@/lib/plans'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/reports', label: 'Reportes', icon: TrendingUp },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

const BOTTOM_NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/reports', label: 'Reportes', icon: TrendingUp },
  { href: '/settings', label: 'Config', icon: Settings },
]

interface NavLinksProps {
  pathname: string
  pendingHref: string | null
  isTransitioning: boolean
  onNavigate: (href: string) => void
  onClose: () => void
}

function NavLinks({ pathname, pendingHref, isTransitioning, onNavigate, onClose }: NavLinksProps) {
  const isNavigating = isTransitioning && pendingHref !== null

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }: any) => {
        const active =
          href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
        const isPending = isTransitioning && pendingHref === href

        return (
          <button
            key={href}
            disabled={isNavigating && !isPending}
            onClick={() => {
              if (active || isPending) return
              onNavigate(href)
              onClose()
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isPending
                ? 'bg-primary text-primary-foreground opacity-70'
                : active
                  ? 'bg-primary text-primary-foreground'
                  : isNavigating
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer'
            )}
          >
            {isPending
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              : <Icon className="h-4 w-4 shrink-0" />
            }
            {label}
          </button>
        )
      })}
    </nav>
  )
}

function PlanIndicator({ planSlug, planName, isTrial, daysLeft }: {
  planSlug: string | null
  planName: string | null
  isTrial: boolean
  daysLeft: number
}) {
  const dotColor = planSlug ? (PLAN_DOT_COLOR[planSlug] ?? 'bg-muted-foreground') : 'bg-muted-foreground'

  return (
    <div className="px-3 pb-2">
      <Link
        href="/settings/billing"
        className="block rounded-lg border bg-muted/30 px-3 py-2.5 hover:bg-muted/60 transition-colors group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
            <span className="text-xs font-medium truncate">
              {planName ?? 'Sin plan'}
            </span>
          </div>
          {isTrial && (
            <span className="text-[10px] font-semibold text-amber-600 shrink-0 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              {daysLeft}d trial
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 group-hover:text-primary transition-colors">
          <CreditCard className="h-2.5 w-2.5" />
          Ver planes
        </p>
      </Link>
    </div>
  )
}

export function Sidebar({
  businessName,
  logoUrl,
  planSlug,
  planName,
  isTrial,
  daysLeft,
}: {
  businessName: string
  logoUrl?: string | null
  planSlug?: string | null
  planName?: string | null
  isTrial?: boolean
  daysLeft?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isTransitioning, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNavigate = (href: string) => {
    setPendingHref(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r bg-background h-screen sticky top-0">
        <div className="px-4 py-4 border-b flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={businessName}
              className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-sm font-bold leading-none">
                {businessName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{businessName}</p>
            <p className="text-xs text-muted-foreground">Puntaje</p>
          </div>
        </div>
        <NavLinks
          pathname={pathname}
          pendingHref={pendingHref}
          isTransitioning={isTransitioning}
          onNavigate={handleNavigate}
          onClose={() => setMobileOpen(false)}
        />
        <PlanIndicator
          planSlug={planSlug ?? null}
          planName={planName ?? null}
          isTrial={isTrial ?? false}
          daysLeft={daysLeft ?? 0}
        />
        <div className="px-3 py-3 border-t">
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground gap-3"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={businessName}
              className="w-7 h-7 rounded-md object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold leading-none">
                {businessName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <p className="font-bold truncate max-w-44">{businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isTrial && (
            <Link
              href="/settings/billing"
              className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200"
            >
              {daysLeft}d trial
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Cerrar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background flex flex-col pt-16">
          <NavLinks
            pathname={pathname}
            pendingHref={pendingHref}
            isTransitioning={isTransitioning}
            onNavigate={handleNavigate}
            onClose={() => setMobileOpen(false)}
          />
          <PlanIndicator
            planSlug={planSlug ?? null}
            planName={planName ?? null}
            isTrial={isTrial ?? false}
            daysLeft={daysLeft ?? 0}
          />
          <div className="px-3 py-3 border-t">
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground gap-3"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile/tablet bottom nav */}
      <nav
        aria-label="Navegacion principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-sm"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-6 gap-1 px-2 pt-2">
          {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href)
            const isPending = isTransitioning && pendingHref === href
            const isNavigating = isTransitioning && pendingHref !== null

            return (
              <button
                key={href}
                disabled={isNavigating && !isPending}
                onClick={() => {
                  if (active || isPending) return
                  handleNavigate(href)
                }}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isPending
                    ? 'bg-primary text-primary-foreground opacity-70'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : isNavigating
                        ? 'text-muted-foreground/40'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Icon className="h-4 w-4" />
                }
                <span className="mt-1 text-[11px] leading-none font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
