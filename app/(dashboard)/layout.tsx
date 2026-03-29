import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan_status')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Staff que no es owner: obtener nombre del negocio por separado
  let staffBusinessName: string | null = null
  if (!business) {
    const { data: staffRecord } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffRecord?.business_id) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', staffRecord.business_id)
        .maybeSingle()
      staffBusinessName = biz?.name ?? null
    }
  }

  const businessName = business?.name ?? staffBusinessName ?? 'Mi negocio'

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <Sidebar businessName={businessName} />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 pb-24 lg:pb-6 max-w-7xl">
          {children}
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
