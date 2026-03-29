'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RedeemableProductRow } from '@/types/database';
import { validateRedemption, redeemProduct } from '@/actions/redeemable';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RedeemablesButtonsProps {
  products: RedeemableProductRow[];
  customerPoints: number;
  customerId: string;
  onRedemptionSuccess?: (updatedBalance: number) => void;
}

type RedemptionStatus = 'idle' | 'validating' | 'processing' | 'success' | 'error';

export function RedeemablesButtons({ products, customerPoints, customerId, onRedemptionSuccess }: RedeemablesButtonsProps) {
  const [selectedProduct, setSelectedProduct] = useState<RedeemableProductRow | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<RedemptionStatus>('idle');
  const [validationError, setValidationError] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  const handleProductClick = async (product: RedeemableProductRow) => {
    // Validar puntos primero
    if (customerPoints < product.points_cost) {
      toast.error('Puntos insuficientes', {
        description: `Necesita ${product.points_cost - customerPoints} puntos más`,
      });
      return;
    }

    setSelectedProduct(product);
    setNotes('');
    setValidationError('');
    setStatus('validating');
    setIsOpen(true);

    // Validar en servidor
    try {
      const result = await validateRedemption(product.id, customerId)
      
      if (!result.isValid) {
        setValidationError(result.reason || 'No se puede canjear este producto')
        setStatus('error');
        return;
      }

      setStatus('idle');
    } catch (error) {
      setValidationError('Error al validar canje');
      setStatus('error');
    }
  };

  const handleConfirmRedemption = async () => {
    if (!selectedProduct) return;

    setStatus('processing');

    try {
      const result = await redeemProduct(selectedProduct.id, customerId, notes);

      if (result.error) {
        setStatus('error');
        setValidationError(result.error);
      } else {
        setStatus('success');
        toast.success('Producto canjeado', {
          description: `Se debitaron ${selectedProduct.points_cost} puntos`,
        });

        if (result.redemption?.whatsapp_sent) {
          toast.success('mensaje enviado');
        } else if (result.redemption?.whatsapp_error) {
          toast.error(result.redemption.whatsapp_error);
        }

        // Llamar callback con nuevo balance (incluye saldo 0)
        const updatedBalance = result.redemption?.new_balance;
        if (typeof updatedBalance === 'number' && onRedemptionSuccess) {
          setTimeout(() => {
            onRedemptionSuccess(updatedBalance);
          }, 500);
        }

        // Cerrar modal después de 2 segundos
        setTimeout(() => {
          setIsOpen(false);
          setSelectedProduct(null);
          setStatus('idle');
          setNotes('');
        }, 2000);
      }
    } catch (error) {
      setStatus('error');
      setValidationError('Error al procesar canje');
    }
  };

  const handleClose = () => {
    if (status !== 'processing') {
      setIsOpen(false);
      setSelectedProduct(null);
      setStatus('idle');
      setNotes('');
      setValidationError('');
    }
  };

  const activeProducts = products.filter(p => p.is_active);

  if (activeProducts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Botones de productos */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700 px-4">
          Productos Canjeables ({activeProducts.length})
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-4">
          {activeProducts.map((product) => {
            const canRedeem = customerPoints >= product.points_cost;
            const hasStock =
              !product.has_stock || (product.stock_quantity && product.stock_quantity > 0);

            return (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                disabled={!canRedeem || !hasStock}
                className={`
                  relative p-3 rounded-lg border-2 transition-all
                  ${
                    canRedeem && hasStock
                      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                      : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {/* Emoji grande */}
                <div className="text-3xl mb-1">
                  {product.emoji || '🎁'}
                </div>

                {/* Nombre */}
                <div className="text-xs font-medium text-gray-900 truncate">
                  {product.name}
                </div>

                {/* Puntos */}
                <div className="text-xs font-bold text-amber-600 mt-1">
                  {product.points_cost} pts
                </div>

                {/* Sin stock */}
                {product.has_stock && product.stock_quantity === 0 && (
                  <div className="absolute top-1 right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                    Sin stock
                  </div>
                )}

                {/* Sin puntos */}
                {!canRedeem && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-700 text-xs py-1 rounded-b text-center">
                    Faltan {product.points_cost - customerPoints} pts
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal de confirmación */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-3xl">{selectedProduct?.emoji}</span>
              {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Confirmar canje de producto
            </DialogDescription>
          </DialogHeader>

          {status === 'validating' && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm text-gray-600">Validando canje...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                ¡Canje completado!
              </span>
              <span className="text-xs text-gray-600">
                Se debitaron {selectedProduct?.points_cost} puntos
              </span>
            </div>
          )}

          {(status === 'idle' || status === 'error') && selectedProduct && (
            <div className="space-y-4 py-4">
              {/* Información del producto */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Costo:</span>
                    <span className="font-semibold text-amber-600">
                      {selectedProduct.points_cost} puntos
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tu saldo:</span>
                    <span className="font-semibold text-gray-900">
                      {customerPoints} puntos
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Después del canje:</span>
                    <span className="font-semibold text-blue-600">
                      {customerPoints - selectedProduct.points_cost} puntos
                    </span>
                  </div>
                </div>
              </div>

              {/* Error si existe */}
              {validationError && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">{validationError}</div>
                </div>
              )}

              {/* Descripción */}
              {selectedProduct.description && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  {selectedProduct.description}
                </div>
              )}

              {/* Notas opcionales */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Notas (opcional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Sin azúcar, para llevar..."
                  className="text-sm resize-none"
                  rows={2}
                  disabled={status !== 'idle'}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={status !== 'idle'}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmRedemption}
                  disabled={status !== 'idle' || validationError !== ''}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {status !== 'idle' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    `Canjear (${selectedProduct.points_cost} pts)`
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
