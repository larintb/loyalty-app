import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas completamente públicas
  const publicPaths = [
    '/login',
    '/register',
    '/api/webhooks',
    '/api/cron',
  ]

  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  if (isPublic) return supabaseResponse

  // Sin sesión → login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Con sesión pero en /login o /register → dashboard
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Verificar onboarding (solo para rutas del dashboard, no /onboarding)
  if (!pathname.startsWith('/onboarding')) {
    const { data: business } = await supabase
      .from('businesses')
      .select('onboarding_completed')
      .eq('owner_id', user.id)
      .maybeSingle()

    // Si el usuario es owner y no completó onboarding
    if (business && !business.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
