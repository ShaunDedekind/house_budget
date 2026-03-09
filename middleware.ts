import { clerkMiddleware } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { userId } = await auth()
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
  const isSetupRoute = pathname === '/setup'
  const isApiRoute = pathname.startsWith('/api/')

  // Unauthenticated: redirect to sign-in for all protected routes
  if (!userId && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Authenticated: redirect away from auth pages
  if (userId && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Authenticated but no household: must complete setup
  if (userId && !isSetupRoute && !isApiRoute && !isAuthRoute) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', userId)
      .single()

    if (!profile || !profile.household_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
