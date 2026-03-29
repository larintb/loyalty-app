'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { createFinanceEntry, type FinanceEntryView } from '@/actions/finance'

const INCOME_CATEGORIES = ['venta', 'servicio', 'anticipo', 'otro']
const EXPENSE_CATEGORIES = ['renta', 'insumos', 'nómina', 'servicios', 'marketing', 'otro']

type Props = {
  entries: FinanceEntryView[]
  summary: { income: number; expense: number; profit: number }
}

export function FinanceClient({ entries: initialEntries, summary }: Props) {
  const [entries, setEntries] = useState<FinanceEntryView[]>(initialEntries)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  return (
    <div className="space-y-6">
      {/* Resumen mensual */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
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
        <Card>
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
        <Card>
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
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Movimientos</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
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
                <div key={entry.id} className="flex items-center justify-between py-3">
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

            <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
