'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, TrendingUp, TrendingDown, Minus, CalendarDays, Lock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  closeFinanceMonth,
  createFinanceEntry,
  openNextFinanceMonth,
  type FinanceEntryView,
  type FinancePeriodView,
} from '@/actions/finance'
import type { FinanceResetMode } from '@/types/database'

const INCOME_CATEGORIES = ['venta', 'servicio', 'anticipo', 'otro']
const EXPENSE_CATEGORIES = ['renta', 'insumos', 'nómina', 'servicios', 'marketing', 'otro']

type Props = {
  entries: FinanceEntryView[]
  period: FinancePeriodView | null
  summary: { income: number; expense: number; profit: number }
}

export function FinanceClient({ entries: initialEntries, period, summary }: Props) {
  const router = useRouter()
  const [entries, setEntries] = useState<FinanceEntryView[]>(initialEntries)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [resetMode, setResetMode] = useState<FinanceResetMode>('carry_over')

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  })

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function resetForm() {
    setForm({
      type: 'expense',
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    })
  }

  function handleSubmit() {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido.')
      return
    }
    if (!form.category) {
      toast.error('Selecciona una categoría.')
      return
    }

    startTransition(async () => {
      const result = await createFinanceEntry({
        type: form.type,
        category: form.category,
        amount,
        description: form.description || undefined,
        date: form.date,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(form.type === 'income' ? 'Ingreso registrado.' : 'Egreso registrado.')
      // Optimistic update
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          type: form.type,
          category: form.category,
          amount,
          description: form.description || null,
          date: form.date,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      resetForm()
      setOpen(false)
    })
  }

  const [currentSummary] = useState(summary)
  const isPeriodClosed = period?.status === 'closed'

  if (!period) {
    return (
      <Card className="card-enter">
        <CardContent className="py-10 text-center space-y-2">
          <p className="text-sm font-medium">Aún no hay periodo financiero activo.</p>
          <p className="text-sm text-muted-foreground">
            El control de finanzas iniciará automáticamente con la primera orden registrada.
          </p>
        </CardContent>
      </Card>
    )
  }

  function handleCloseMonth() {
    startTransition(async () => {
      const result = await closeFinanceMonth(period?.month)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Periodo cerrado.')
      router.refresh()
    })
  }

  function handleOpenNextMonth() {
    startTransition(async () => {
      const result = await openNextFinanceMonth(period?.month, resetMode)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Siguiente periodo creado.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 page-enter">
      {period && (
        <Card className="card-enter border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Control de periodo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={isPeriodClosed ? 'secondary' : 'default'}>
                {isPeriodClosed ? 'Cerrado' : 'Abierto'}
              </Badge>
              <span className="text-muted-foreground">{period.periodStart} al {period.periodEnd}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Saldo inicial</p>
                <p className="font-semibold">${period.openingBalance.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="font-semibold text-green-700 dark:text-green-400">${period.totalIncome.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Egresos</p>
                <p className="font-semibold text-red-700 dark:text-red-400">${period.totalExpense.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Saldo final</p>
                <p className="font-semibold">${period.closingBalance.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCloseMonth}
                disabled={isPending || isPeriodClosed}
              >
                <Lock className="h-4 w-4" />
                Cerrar mes
              </Button>

              <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resetMode === 'carry_over'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => setResetMode('carry_over')}
                  disabled={isPending}
                >
                  Arrastrar saldo
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resetMode === 'zero_base'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => setResetMode('zero_base')}
                  disabled={isPending}
                >
                  Reiniciar en cero
                </button>
              </div>

              <Button
                className="gap-2"
                onClick={handleOpenNextMonth}
                disabled={isPending || !isPeriodClosed}
              >
                <RefreshCw className="h-4 w-4" />
                Abrir siguiente mes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen mensual */}
      <div className="grid grid-cols-3 gap-3 motion-stagger">
        <Card className="lift-hover">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs text-muted-foreground">Ingresos</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              ${currentSummary.income.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card className="lift-hover">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-muted-foreground">Egresos</span>
            </div>
            <p className="text-xl font-bold text-red-500">
              ${currentSummary.expense.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card className="lift-hover">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Utilidad</span>
            </div>
            <p
              className={`text-xl font-bold ${
                currentSummary.profit >= 0 ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {currentSummary.profit >= 0 ? '+' : ''}${currentSummary.profit.toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de movimientos */}
      <Card className="card-enter">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Movimientos</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5" disabled={isPending || isPeriodClosed}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Sin movimientos este mes. Las ventas del POS aparecen automáticamente.
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3 rounded-md px-1 transition-colors duration-200 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={entry.type === 'income' ? 'default' : 'destructive'}
                      className="text-xs capitalize shrink-0"
                    >
                      {entry.category}
                    </Badge>
                    <div>
                      {entry.description && (
                        <p className="text-sm">{entry.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date + 'T12:00:00').toLocaleDateString('es-MX', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      entry.type === 'income' ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {entry.type === 'income' ? '+' : '−'}${entry.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal agregar entrada */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              {(['income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((p) => ({ ...p, type: t, category: '' }))}
                  className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === 'income'
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {t === 'income' ? '↑ Ingreso' : '↓ Egreso'}
                </button>
              ))}
            </div>

            <Separator />

            {/* Monto */}
            <div className="space-y-1.5">
              <Label>Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="pl-7"
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm((p) => ({ ...p, category: cat }))}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors capitalize ${
                      form.category === cat
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label>
                Descripción{' '}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Pago de renta mayo..."
              />
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isPending || isPeriodClosed}>
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>

            {isPeriodClosed && (
              <p className="text-xs text-amber-600 text-center">
                Este periodo está cerrado. Debes abrir el siguiente para registrar movimientos.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
