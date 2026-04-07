import { NextResponse, type NextRequest } from 'next/server'
import { locales, defaultLocale } from '@/lib/i18n/translations'

function getLocale(request: NextRequest): string {
  // 1. Respect persisted locale preference cookie (set when user toggles language)
  const cookieLocale = request.cookies.get('ee-locale')?.value
  if (cookieLocale && locales.includes(cookieLocale as 'en' | 'es')) {
    return cookieLocale
  }
  // 2. Fall back to Accept-Language header
  const acceptLanguage = request.headers.get('accept-language') ?? ''
  const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
  return locales.includes(preferred as 'en' | 'es') ? preferred! : defaultLocale
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
