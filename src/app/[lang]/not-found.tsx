'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Localized 404 for /[lang] — replaces Next's unstyled English default. Triggered
// by notFound() (e.g. sala/[bookingId]) and unmatched routes under a locale.
// Read the (unsigned, UX-only) ee-role fast-path cookie on the client, mirroring
// FinalCTA. Used as a fallback when the path alone doesn't reveal the in-app area.
function readRoleCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)ee-role=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function LangNotFound() {
  const pathname = usePathname()
  const isEs = !pathname?.startsWith('/en')
  const lang = isEs ? 'es' : 'en'

  // For in-app 404s (e.g. a stale /dashboard/... or /admin/... deep link), send
  // the user back to their dashboard root instead of the public landing. Detect
  // the area from the path first, then fall back to the ee-role cookie; otherwise
  // keep the marketing landing target.
  const path = pathname || ''
  // Cookie is read ONLY after mount (null on first paint) so SSR and the first
  // client render agree — reading document.cookie during render would mismatch
  // hydration (mirrors FinalCTA). Path-based detection below is SSR-safe.
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => { setRole(readRoleCookie()) }, [])

  let home = `/${lang}`
  let backHome = isEs ? 'Volver al inicio →' : 'Back home →'
  const dashLabel = isEs ? 'Volver al panel →' : 'Back to dashboard →'
  if (path.startsWith(`/${lang}/admin`)) {
    home = `/${lang}/admin`
    backHome = dashLabel
  } else if (path.startsWith(`/${lang}/maestro`)) {
    home = `/${lang}/maestro/dashboard`
    backHome = dashLabel
  } else if (path.startsWith(`/${lang}/dashboard`)) {
    home = `/${lang}/dashboard`
    backHome = dashLabel
  } else if (role === 'admin') {
    home = `/${lang}/admin`
    backHome = dashLabel
  } else if (role === 'teacher') {
    home = `/${lang}/maestro/dashboard`
    backHome = dashLabel
  } else if (role === 'student') {
    home = `/${lang}/dashboard`
    backHome = dashLabel
  }

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: 'var(--ek-paper)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--ek-font-mono)',
          color: 'var(--ek-text-muted)',
          fontSize: 14,
          letterSpacing: '0.15em',
          margin: 0,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: 'var(--ek-font-serif)',
          fontSize: 'clamp(36px, 7vw, 60px)',
          lineHeight: 1.05,
          color: 'var(--ek-text)',
          margin: '10px 0 0',
        }}
      >
        {isEs ? 'No encontramos esta página' : "We couldn't find this page"}
      </h1>
      <p
        style={{
          fontFamily: 'var(--ek-font-sans)',
          color: 'var(--ek-text-soft)',
          fontSize: 17,
          maxWidth: 420,
          marginTop: 16,
          lineHeight: 1.5,
        }}
      >
        {isEs
          ? 'La página que buscas no existe o se movió.'
          : 'The page you’re looking for doesn’t exist or has moved.'}
      </p>
      <a
        href={home}
        style={{ marginTop: 24, color: 'var(--ek-red)', textDecoration: 'none', fontSize: 15, fontFamily: 'var(--ek-font-sans)' }}
      >
        {backHome}
      </a>
    </div>
  )
}
