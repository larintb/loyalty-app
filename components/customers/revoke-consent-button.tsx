'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { revokeCustomerConsent } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  consentId: string
  customerId: string
}

export function RevokeConsentButton({ consentId, customerId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await revokeCustomerConsent(consentId, customerId, reason)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Consentimiento revocado')
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Revocar consentimiento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar revocación</DialogTitle>
            <DialogDescription>
              Esta acción desactiva el consentimiento actual para este cliente y se guardará en la auditoría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Motivo (opcional)</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Solicitud del cliente por WhatsApp"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Revocando...' : 'Confirmar revocación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
