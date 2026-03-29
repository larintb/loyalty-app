'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { logout } from '@/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/finance', label: 'Finanzas', icon: DollarSign },
  { href: '/reports', label: 'Reportes', icon: TrendingUp },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

interface NavLinksProps {
  pathname: string
  onClose: () => void
}

function NavLinks({ pathname, onClose }: NavLinksProps) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background h-screen sticky top-0">
        <div className="px-4 py-5 border-b">
          <p className="font-bold text-base truncate">{businessName}</p>
          <p className="text-xs text-muted-foreground">Puntaje</p>
        </div>
        <NavLinks pathname={pathname} onClose={() => setMobileOpen(false)} />
        <div className="px-3 py-4 border-t">
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
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-40">
        <p className="font-bold truncate max-w-[200px]">{businessName}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col pt-16">
          <NavLinks pathname={pathname} onClose={() => setMobileOpen(false)} />
          <div className="px-3 py-4 border-t">
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
    </>
  )
}
