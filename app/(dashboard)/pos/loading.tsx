import { Skeleton } from '@/components/ui/skeleton'

export default function POSLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-40" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: search customer */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Points input */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {/* Right: redeemable products */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-t first:border-0">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
