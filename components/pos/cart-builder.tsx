'use client'

import { useState } from 'react'
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { TransactionItem } from '@/types/database'

type Props = {
  onCartChange: (items: TransactionItem[], subtotal: number) => void
}

export function CartBuilder({ onCartChange }: Props) {
  const [items, setItems] = useState<TransactionItem[]>([])
  const [newItem, setNewItem] = useState({ name: '', price: '', quantity: '1' })

  function notify(updated: TransactionItem[]) {
    const subtotal = updated.reduce((s, i) => s + i.price * i.quantity, 0)
    onCartChange(updated, subtotal)
  }

  function addItem() {
    const price = parseFloat(newItem.price)
    const quantity = parseInt(newItem.quantity) || 1
    if (!newItem.name.trim() || isNaN(price) || price <= 0) return

    const updated = [
      ...items,
      { name: newItem.name.trim(), price, quantity },
    ]
    setItems(updated)
    notify(updated)
    setNewItem({ name: '', price: '', quantity: '1' })
  }

  function updateQty(index: number, delta: number) {
    const updated = items
      .map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    setItems(updated)
    notify(updated)
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    notify(updated)
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <div className="space-y-4">
      {/* Formulario agregar item */}
      <div className="flex gap-2">
        <Input
          placeholder="Producto"
          value={newItem.name}
          onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          className="flex-1"
        />
        <Input
          placeholder="$0.00"
          value={newItem.price}
          onChange={(e) => setNewItem((p) => ({ ...p, price: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          className="w-24"
          inputMode="decimal"
        />
        <Input
          value={newItem.quantity}
          onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))}
          className="w-16 text-center"
          inputMode="numeric"
        />
        <Button onClick={addItem} size="icon" variant="outline">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista de items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Agrega productos a la venta</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40">
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              <span className="text-sm text-muted-foreground w-16 text-right">
                ${item.price.toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => updateQty(i, -1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => updateQty(i, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm font-semibold w-16 text-right">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <Separator />
          <div className="flex justify-between px-3 font-semibold">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
