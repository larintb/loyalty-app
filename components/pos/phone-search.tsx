'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { searchCustomerByPhone } from '@/actions/customers'

type CustomerPreview = {
  id: string
  name: string
  phone: string
  total_points: number
  visit_count: number
  last_visit_at: string | null
}

type Props = {
  onCustomerFound: (customer: CustomerPreview) => void
  onCustomerCleared: () => void
  onRegisterNew: (phone: string) => void
}

export function PhoneSearch({ onCustomerFound, onCustomerCleared, onRegisterNew }: Props) {
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle')
  const [customer, setCustomer] = useState<CustomerPreview | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')

    if (digits.length < 10) {
      setStatus('idle')
      setCustomer(null)
      onCustomerCleared()
      return
    }

    setStatus('searching')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const result = await searchCustomerByPhone(digits)
      if (result) {
        setStatus('found')
        setCustomer(result)
        onCustomerFound(result)
      } else {
        setStatus('not_found')
        setCustomer(null)
        onCustomerCleared()
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])

  function handleClear() {
    setPhone('')
    setStatus('idle')
    setCustomer(null)
    onCustomerCleared()
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="(55) 1234-5678"
          className="pl-9 pr-9 text-lg h-12 font-mono"
          inputMode="numeric"
          autoFocus
        />
        {phone && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Estado: buscando */}
      {status === 'searching' && (
        <p className="text-sm text-muted-foreground animate-pulse">Buscando...</p>
      )}

      {/* Estado: cliente encontrado */}
      {status === 'found' && customer && (
        <div className="flex items-center justify-between rounded-lg border bg-green-50 dark:bg-green-950/20 px-4 py-3">
          <div>
            <p className="font-semibold">{customer.name}</p>
            <p className="text-sm text-muted-foreground">
              {customer.visit_count} visitas ·{' '}
              {customer.last_visit_at
                ? `Última: ${new Date(customer.last_visit_at).toLocaleDateString('es-MX')}`
                : 'Primera vez'}
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">
            ⭐ {customer.total_points} pts
          </Badge>
        </div>
      )}

      {/* Estado: no encontrado */}
      {status === 'not_found' && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Número no registrado
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegisterNew(phone.replace(/\D/g, ''))}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Registrar
          </Button>
        </div>
      )}
    </div>
  )
}
