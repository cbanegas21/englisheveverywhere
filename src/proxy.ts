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

  if (hasLocale) return NextResponse.next()

  // Redirect to locale-prefixed path
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
