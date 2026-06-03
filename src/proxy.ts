import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { locales, defaultLocale } from '@/lib/i18n/translations'
import { ROLE_COOKIE } from '@/lib/authCookie'

function getLocale(request: NextRequest): string {
  // Respect persisted locale cookie (set when user toggles language).
  // Do NOT fall back to Accept-Language — this app is Spanish-first for Latin America.
  const cookieLocale = request.cookies.get('ee-locale')?.value
  if (cookieLocale && locales.includes(cookieLocale as 'en' | 'es')) {
    return cookieLocale
  }
  return defaultLocale // always 'es' unless user has explicitly switched
}

// Fast-path role home per role — proxy-only, locale is prepended by caller.
// Layout guards remain the source of truth; cookie absence falls through to them.
const ROLE_HOME: Record<string, string> = {
  admin: 'admin',
  teacher: 'maestro/dashboard',
  student: 'dashboard',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip Next.js internals and static files (also excluded by `matcher` below —
  // cheap guard so we never run the auth refresh for assets).
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // ── Supabase session refresh — REQUIRED by @supabase/ssr ──────────────────
  // Re-emits refreshed auth cookies on every request so that sessions written by
  // the signUp / signIn server actions (server.ts setAll) actually persist to the
  // browser. Without this step a freshly-authenticated user looks logged-out on
  // the very next navigation and gets bounced back to /login (the signup loop).
  // The refreshed Set-Cookie headers live on `response`; every early redirect
  // below copies them via withAuth() so the session is never dropped.
  let response = NextResponse.next({ request })
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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  // Do NOT run code between createServerClient and getUser() — @supabase/ssr
  // relies on this call to rotate the refresh token and emit fresh cookies.
  await supabase.auth.getUser()

  // Copy the refreshed auth cookies onto any response we return early so a
  // short-circuit redirect can't strip a just-refreshed session.
  const withAuth = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
    return target
  }

  // ── Locale prefix ─────────────────────────────────────────────────────────
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!hasLocale) {
    const locale = getLocale(request)
    request.nextUrl.pathname = `/${locale}${pathname}`
    return withAuth(NextResponse.redirect(request.nextUrl))
  }

  // ── Role-guard fast path ──────────────────────────────────────────────────
  // Cookie-absent = let layout guards handle auth/role (they read profiles.role
  // as the canonical source). Cookie-present mismatch = short-circuit redirect so
  // the wrong-role UI never flashes.
  const role = request.cookies.get(ROLE_COOKIE)?.value
  if (!role) return response

  const segments = pathname.split('/').filter(Boolean)
  const lang = segments[0]
  const afterLocale = segments.slice(1).join('/')

  const wantsAdmin = afterLocale === 'admin' || afterLocale.startsWith('admin/')
  const wantsTeacher = afterLocale === 'maestro' || afterLocale.startsWith('maestro/')
  const wantsStudent = afterLocale === 'dashboard' || afterLocale.startsWith('dashboard/')

  const mismatch =
    (wantsAdmin && role !== 'admin') ||
    (wantsTeacher && role !== 'teacher') ||
    (wantsStudent && role !== 'student')

  if (mismatch) {
    const home = ROLE_HOME[role]
    if (home) {
      const target = `/${lang}/${home}`
      if (target !== pathname) {
        request.nextUrl.pathname = target
        return withAuth(NextResponse.redirect(request.nextUrl))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
