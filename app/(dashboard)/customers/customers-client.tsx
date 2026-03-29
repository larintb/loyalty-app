'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Star, ShoppingBag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPhoneDisplay } from '@/lib/utils/phone'

type Customer = {
  id: string
  name: string
  phone: string
  email: string | null
  total_points: number
  lifetime_spend: number
  visit_count: number
  last_visit_at: string | null
  created_at: string
}

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')

  function applySearch() {
    setSearch(searchDraft.trim())
  }

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.phone.includes(search)
  })

  return (
    <div className="space-y-4 page-enter">
      {/* Búsqueda */}
      <div className="flex items-center gap-2 card-enter">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Buscar por nombre o teléfono..."
            className="pl-9"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="xl:hidden gap-2"
          onClick={applySearch}
        >
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </div>

      {/* Contador */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        {search && ` · búsqueda "${search}"`}
      </p>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="card-enter">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? 'Sin resultados para esa búsqueda.' : 'Aún no tienes clientes registrados.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 motion-stagger">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors lift-hover"
              onClick={() => router.push(`/customers/${c.id}`)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.total_points > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Star className="h-2.5 w-2.5 mr-0.5" />
                          {c.total_points} pts
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatPhoneDisplay(c.phone)}
                      {c.last_visit_at && (
                        <> · Última visita:{' '}
                          {new Date(c.last_visit_at).toLocaleDateString('es-MX', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold text-sm">${Number(c.lifetime_spend).toFixed(0)}</p>
                    <div className="flex items-center gap-0.5 text-xs text-muted-foreground justify-end">
                      <ShoppingBag className="h-3 w-3" />
                      {c.visit_count}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

