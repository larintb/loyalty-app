import { Skeleton } from '@/components/ui/skeleton'

export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>

      {/* Metric pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Two column bottom */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-t first:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-t first:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
