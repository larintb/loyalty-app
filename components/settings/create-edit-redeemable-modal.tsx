'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? 'Editar producto' : 'Nuevo producto canjeable'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label>Nombre del producto *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: ☕ Café Gratis"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: Café expreso pequeño, sin azúcar"
              rows={2}
            />
          </div>

          {/* Costo en puntos */}
          <div className="space-y-2">
            <Label>Costo en puntos *</Label>
            <Input
              value={form.points_cost}
              onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
              placeholder="100"
              inputMode="numeric"
              type="number"
              min="1"
            />
          </div>

          {/* Emoji */}
          <div className="space-y-2">
            <Label>Emoji (opcional)</Label>
            <Input
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="🎁"
              maxLength={2}
              className="text-2xl text-center h-12"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  className={`w-full h-10 rounded-lg border-2 transition-all ${
                    form.color === color
                      ? 'border-foreground'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Ícono */}
          <div className="space-y-2">
            <Label>Ícono lucide-react</Label>
            <Select value={form.icon_name || ''} onValueChange={(v) => {
              if (v) setForm({ ...form, icon_name: v })
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado activo */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label className="font-normal">¿Activo?</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          {/* Stock */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-normal">¿Tiene límite de stock?</Label>
              <Switch
                checked={form.has_stock}
                onCheckedChange={(v) => setForm({ ...form, has_stock: v })}
              />
            </div>
            {form.has_stock && (
              <Input
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                placeholder="Cantidad disponible"
                inputMode="numeric"
                type="number"
                min="0"
              />
            )}
          </div>

          {/* Límites de canjes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Max canjes/día (opcional)</Label>
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
              <Label className="text-xs">Max por cliente (opcional)</Label>
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

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending} className="flex-1">
              {isPending ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
