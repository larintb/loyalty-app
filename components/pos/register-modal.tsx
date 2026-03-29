'use client'

import { useActionState } from 'react'
import { registerCustomer } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'

type Props = {
  open: boolean
  defaultPhone: string
  onClose: () => void
  onRegistered: (customerId: string) => void
}

export function RegisterModal({ open, defaultPhone, onClose, onRegistered }: Props) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await registerCustomer(prev, formData)
      if (result?.customerId) {
        onRegistered(result.customerId)
        onClose()
      }
      return result
    },
    null
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar nuevo cliente</DialogTitle>
          <DialogDescription>
            El cliente acumulará puntos desde esta venta.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Juan Pérez" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={defaultPhone}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
              placeholder="5512345678"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              Correo <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input id="email" name="email" type="email" placeholder="juan@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthday">
              Cumpleaños <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input id="birthday" name="birthday" type="date" />
          </div>
          {state?.error && <FormError message={state.error} />}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? 'Registrando...' : 'Registrar cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
