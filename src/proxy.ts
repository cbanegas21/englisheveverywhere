import { NextResponse, type NextRequest } from 'next/server'
import { locales, defaultLocale } from '@/lib/i18n/translations'

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if pathname already has a locale
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!hasLocale) {
    const locale = getLocale(request)
    request.nextUrl.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(request.nextUrl)
  }

  // Role-guard fast path. Cookie-absent = let layout guards handle auth/role
  // (they read profiles.role as the canonical source). Cookie-present mismatch
  // = short-circuit redirect so the wrong-role UI never flashes.
  const role = request.cookies.get('ee-role')?.value
  if (!role) return NextResponse.next()

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
        return NextResponse.redirect(request.nextUrl)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
