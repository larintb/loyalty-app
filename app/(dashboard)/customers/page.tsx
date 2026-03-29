import { getCustomers } from '@/actions/customers'
import { CustomersClient } from './customers-client'

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} registrado{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <CustomersClient customers={customers} />
    </div>
  )
}
