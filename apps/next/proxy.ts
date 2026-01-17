import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
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

  // Protected routes - redirect to login if not authenticated
  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin routes - check for admin or moderator role
  if (pathname.startsWith('/admin') && user) {
    const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
      supabase.rpc('user_has_role', { p_user_id: user.id, p_role_name: 'admin' }),
      supabase.rpc('user_has_role', { p_user_id: user.id, p_role_name: 'moderator' }),
    ])

    if (!isAdmin && !isModerator) {
      const url = request.nextUrl.clone()
      url.pathname = '/404'
      return NextResponse.rewrite(url)
    }
  }

  // Auth routes - redirect to dashboard if already authenticated
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/signup'],
}
