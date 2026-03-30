'use client'

import { BarChart3, ArrowRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function ReportsPaywall() {
  const handleUpgrade = () => {
    // Navegar a settings/billing o a Mercado Pago
    window.location.href = '/settings/billing'
  }

  return (
    <div className="flex items-center justify-center min-h-150 px-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-blue-200 bg-linear-to-br from-blue-50 to-blue-50/50 p-8">
          {/* Ícono */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-blue-100 p-4">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          {/* Título */}
          <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">
            Reportes Avanzados
          </h2>

          {/* Descripción */}
          <p className="mb-6 text-center text-gray-600">
            Obtén análisis detallados de tus ventas, clientes y puntos. Toma decisiones basadas en datos reales.
          </p>

          {/* Beneficios */}
          <div className="mb-8 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-900">Análisis de Ventas</p>
                <p className="text-sm text-gray-600">Gráficos y métricas en tiempo real</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-900">Segmentación de Clientes</p>
                <p className="text-sm text-gray-600">Identifica tus clientes más valiosos</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-900">Reportes de Puntos</p>
                <p className="text-sm text-gray-600">Gestiona tu programa de lealtad</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-8 rounded-lg bg-white p-4 text-center">
            <p className="text-sm text-gray-600">Plan Pro</p>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-gray-900">$999</span>
              <span className="text-gray-600">MXN/mes</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Incluye Reportes + Finanzas + herramientas de crecimiento
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleUpgrade}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-semibold"
          >
            Mejorar Plan
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-gray-500">
            Sin compromiso. Cancela en cualquier momento desde Settings
          </p>
        </Card>
      </div>
    </div>
  )
}
