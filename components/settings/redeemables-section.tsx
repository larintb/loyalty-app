'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Edit2, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  deleteRedeemableProduct,
  getBusinessRedeemables,
} from '@/actions/redeemable'
import type { RedeemableProductRow } from '@/types/database'
import { CreateEditRedeemableModal } from './create-edit-redeemable-modal'

export function RedeemablesSection({
  initialProducts,
}: {
  initialProducts: RedeemableProductRow[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<RedeemableProductRow | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleProductCreated = (newProduct: RedeemableProductRow) => {
    setProducts((prev) => [newProduct, ...prev])
    setIsModalOpen(false)
    toast.success(`${newProduct.name} creado`)
  }

  const handleProductUpdated = (updatedProduct: RedeemableProductRow) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    )
    setEditingProduct(null)
    toast.success(`${updatedProduct.name} actualizado`)
  }

  const handleDelete = async (id: string, name: string) => {
    setIsDeleting(id)
    const result = await deleteRedeemableProduct(id)
    setIsDeleting(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setProducts((prev) => prev.filter((p) => p.id !== id))
    toast.success(`${name} eliminado`)
  }

  return (
    <section className="card-enter">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/30 shrink-0">
            <span className="text-lg">🎁</span>
          </div>
          <div>
            <h2 className="font-semibold text-base leading-none">Productos canjeables</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Los clientes pueden canjear estos productos usando sus puntos
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null)
            setIsModalOpen(true)
          }}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo producto
        </Button>
      </div>

      {/* Lista de productos */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Sin productos canjeables aún
          </p>
          <Button
            onClick={() => {
              setEditingProduct(null)
              setIsModalOpen(true)
            }}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between rounded-xl border bg-card p-4 transition-all duration-200 group hover:bg-muted/40 active:scale-95 cursor-pointer"
            >
              {/* Información del producto */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: product.color + '20' }}
                >
                  {product.emoji || '🎁'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                    {!product.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {product.points_cost} puntos
                    {product.has_stock && product.stock_quantity !== null && (
                      <> • {product.stock_quantity} en stock</>
                    )}
                  </p>
                </div>
              </div>

              {/* Acciones - Siempre visibles */}
              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                <Button
                  onClick={() => {
                    setEditingProduct(product)
                    setIsModalOpen(true)
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-950"
                  title="Editar producto"
                >
                  <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                </Button>
                <Button
                  onClick={() => handleDelete(product.id, product.name)}
                  disabled={isDeleting === product.id}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-950"
                  title="Eliminar producto"
                >
                  {isDeleting === product.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para crear/editar */}
      {isModalOpen && (
        <CreateEditRedeemableModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingProduct(null)
          }}
          editingProduct={editingProduct}
          onProductCreated={handleProductCreated}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </section>
  )
}
