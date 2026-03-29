'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { DailySale } from '@/actions/reports'

const SHORT_MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function formatDate(dateStr: string, totalDays: number): string {
  const [, month, day] = dateStr.split('-').map(Number)
  if (totalDays <= 14) return `${day}/${month}`
  if (totalDays <= 30) {
    // Solo mostrar cada 3 días para no saturar
    return day % 3 === 0 ? `${day} ${SHORT_MONTHS[month - 1]}` : ''
  }
  // 90 días: solo semanas
  return day === 1 || day === 8 || day === 15 || day === 22 ? `${day} ${SHORT_MONTHS[month - 1]}` : ''
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const [, month, day] = label.split('-').map(Number)
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-foreground mb-0.5">
        {day} {SHORT_MONTHS[month - 1]}
      </p>
      <p className="text-muted-foreground">
        Ventas:{' '}
        <span className="font-semibold text-foreground">
          ${Number(payload[0].value).toFixed(0)}
        </span>
      </p>
      {payload[0].payload.count > 0 && (
        <p className="text-muted-foreground text-xs">
          {payload[0].payload.count} transacción{payload[0].payload.count !== 1 ? 'es' : ''}
        </p>
      )}
    </div>
  )
}

export function SalesChart({ data, days }: { data: DailySale[]; days: number }) {
  const hasData = data.some((d) => d.total > 0)
  const maxVal = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="h-48 w-full">
      {!hasData ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Sin ventas en este período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v, days)}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(maxVal * 1.1)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
            <Bar
              dataKey="total"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
