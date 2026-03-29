import { getFinanceEntries, type FinanceEntryView } from '@/actions/finance'
import { FinanceClient } from './finance-client'

export default async function FinancePage() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const entries = await getFinanceEntries(month)

  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

  const monthLabel = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <p className="text-muted-foreground text-sm capitalize">{monthLabel}</p>
      </div>
      <FinanceClient
        entries={entries}
        summary={{ income, expense, profit: income - expense }}
        month={month}
      />
    </div>
  )
}
