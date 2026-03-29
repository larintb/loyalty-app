'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createRedeemableProduct,
  updateRedeemableProduct,
} from '@/actions/redeemable'
import type { RedeemableProductRow } from '@/types/database'

// Íconos disponibles de lucide-react
const ICON_OPTIONS = [
  'gift',
  'coffee',
  'cookie',
  'pizza',
  'star',
  'heart',
  'zap',
  'percent',
  'shopping-bag',
  'crown',
]

// Colores disponibles
const COLOR_OPTIONS = [
  '#3B82F6', // azul
  '#EC4899', // rosa
  '#F59E0B', // ambar
  '#10B981', // verde
  '#8B5CF6', // púrpura
  '#EF4444', // rojo
  '#06B6D4', // cyan
  '#6366F1', // indigo
]

export function CreateEditRedeemableModal({
  isOpen,
  onClose,
  editingProduct,
  onProductCreated,
  onProductUpdated,
}: {
  isOpen: boolean
  onClose: () => void
  editingProduct: RedeemableProductRow | null
  onProductCreated: (product: RedeemableProductRow) => void
  onProductUpdated: (product: RedeemableProductRow) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: editingProduct?.name ?? '',
    description: editingProduct?.description ?? '',
    points_cost: String(editingProduct?.points_cost ?? 100),
    emoji: editingProduct?.emoji ?? '🎁',
    color: editingProduct?.color ?? '#3B82F6',
    icon_name: (editingProduct?.icon_name ?? 'gift') as string,
    is_active: editingProduct?.is_active ?? true,
    has_stock: editingProduct?.has_stock ?? false,
    stock_quantity: String(editingProduct?.stock_quantity ?? 0),
    max_redeems_per_day: String(editingProduct?.max_redeems_per_day ?? ''),
    max_redeems_per_customer: String(editingProduct?.max_redeems_per_customer ?? ''),
  })

  const handleSave = () => {
    // Validaciones
    if (!form.name.trim()) {
      toast.error('El nombre del producto es obligatorio')
      return
    }

    const pointsCost = parseInt(form.points_cost)
    if (!pointsCost || pointsCost <= 0) {
      toast.error('El costo en puntos debe ser mayor a 0')
      return
    }

    const stockQty = form.has_stock ? parseInt(form.stock_quantity) : null
    if (form.has_stock && (stockQty === null || stockQty < 0)) {
      toast.error('La cantidad de stock debe ser válida')
      return
    }

    const input = {
      name: form.name.trim(),
      description: form.description || null,
      points_cost: pointsCost,
      emoji: form.emoji || null,
      color: form.color,
      icon_name: form.icon_name,
      is_active: form.is_active,
      has_stock: form.has_stock,
      stock_quantity: form.has_stock ? stockQty : null,
      max_redeems_per_day: form.max_redeems_per_day ? parseInt(form.max_redeems_per_day) : null,
      max_redeems_per_customer: form.max_redeems_per_customer ? parseInt(form.max_redeems_per_customer) : null,
    }

    startTransition(async () => {
      if (editingProduct) {
        // Actualizar producto existente
        const result = await updateRedeemableProduct(editingProduct.id, input as any)
        if (result.error) {
          toast.error(result.error)
        } else {
          // Refrescar datos del producto
          const { data: products } = await (
            await import('@/actions/redeemable')
          ).getBusinessRedeemables()
          if (products) {
            const updated = products.find((p) => p.id === editingProduct.id)
            if (updated) {
              onProductUpdated(updated)
            }
          }
        }
      } else {
        // Crear nuevo producto
        const result = await createRedeemableProduct(input as any)
        if (result.error) {
          toast.error(result.error)
        } else {
          // Refrescar lista
          const { data: products } = await (
            await import('@/actions/redeemable')
          ).getBusinessRedeemables()
          if (products && result.id) {
            const created = products.find((p) => p.id === result.id)
            if (created) {
              onProductCreated(created)
            }
          }
        }
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? 'Editar producto' : 'Nuevo producto canjeable'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="design">Diseño</TabsTrigger>
            <TabsTrigger value="advanced">Config</TabsTrigger>
          </TabsList>

          {/* TAB 1: INFORMACIÓN BÁSICA */}
          <TabsContent value="basic" className="space-y-4">
            {/* Preview del producto */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 text-center border border-blue-100">
              <div className="text-5xl mb-3">{form.emoji || '🎁'}</div>
              <div className="font-semibold text-gray-900">{form.name || 'Sin nombre'}</div>
              <div className="text-sm text-amber-600 font-bold mt-2">
                {form.points_cost} puntos
              </div>
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name" className="font-medium">
                Nombre del producto *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Café Campeón"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-medium">
                Descripción (opcional)
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Bebida fría con hielo, disponible en varios sabores"
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Costo en puntos */}
            <div className="space-y-2">
              <Label htmlFor="points" className="font-medium">
                Costo en puntos *
              </Label>
              <div className="relative">
                <Input
                  id="points"
                  value={form.points_cost}
                  onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
                  placeholder="100"
                  inputMode="numeric"
                  type="number"
                  min="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-amber-600">
                  pts
                </span>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: DISEÑO */}
          <TabsContent value="design" className="space-y-5">
            {/* Preview del diseño */}
            <div
              className="h-32 rounded-xl flex items-center justify-center text-6xl transition-all"
              style={{
                backgroundColor: form.color + '15',
                borderColor: form.color,
                borderWidth: '2px',
              }}
            >
              {form.emoji || '🎁'}
            </div>

            {/* Emoji */}
            <div className="space-y-2">
              <Label htmlFor="emoji" className="font-medium">
                Emoji (opcional)
              </Label>
              <Input
                id="emoji"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="🎁"
                maxLength={2}
                className="text-3xl text-center h-14 font-bold"
              />
              <p className="text-xs text-gray-500 text-center">
                Presiona Win + . para abrir selector de emojis
              </p>
            </div>

            {/* Color - Palette mejorada */}
            <div className="space-y-3">
              <Label className="font-medium">Color del producto</Label>
              <div className="grid grid-cols-4 gap-2.5">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    className={`h-12 rounded-xl border-2 transition-all transform hover:scale-105 shadow-sm ${
                      form.color === color
                        ? 'border-gray-900 scale-105 shadow-md'
                        : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Ícono lucide */}
            <div className="space-y-2">
              <Label htmlFor="icon" className="font-medium">
                Ícono (optional)
              </Label>
              <Select value={form.icon_name || ''} onValueChange={(v) => {
                if (v) setForm({ ...form, icon_name: v })
              }}>
                <SelectTrigger id="icon">
                  <SelectValue placeholder="Selecciona un ícono" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <span className="capitalize">{icon}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* TAB 3: CONFIGURACIÓN AVANZADA */}
          <TabsContent value="advanced" className="space-y-4">
            {/* Estado activo */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <Label className="font-medium text-gray-900">Producto activo</Label>
                <p className="text-xs text-gray-600 mt-1">
                  {form.is_active ? '✓ Disponible para canjeadores' : '⊘ No disponible'}
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            {/* Stock */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <Label className="font-medium text-gray-900">Limitar stock</Label>
                  <p className="text-xs text-gray-600 mt-1">
                    {form.has_stock
                      ? `⊙ Control activo: ${form.stock_quantity || 0} unidades`
                      : '◌ Sin límite de stock'}
                  </p>
                </div>
                <Switch
                  checked={form.has_stock}
                  onCheckedChange={(v) => setForm({ ...form, has_stock: v })}
                />
              </div>
              {form.has_stock && (
                <Input
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  placeholder="0"
                  inputMode="numeric"
                  type="number"
                  min="0"
                  className="border-amber-300"
                />
              )}
            </div>

            {/* Límites de canjes */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <Label className="font-medium text-gray-900">Límites de canjes (opcional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Máx. por día</Label>
                  <Input
                    value={form.max_redeems_per_day}
                    onChange={(e) =>
                      setForm({ ...form, max_redeems_per_day: e.target.value })
                    }
                    placeholder="Ilimitado"
                    inputMode="numeric"
                    type="number"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Máx. por cliente</Label>
                  <Input
                    value={form.max_redeems_per_customer}
                    onChange={(e) =>
                      setForm({ ...form, max_redeems_per_customer: e.target.value })
                    }
                    placeholder="Ilimitado"
                    inputMode="numeric"
                    type="number"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Botones */}
        <div className="flex gap-2 pt-4 border-t mt-6">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isPending ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear producto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
