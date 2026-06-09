'use client'

import { usePathname } from 'next/navigation'

// Localized 404 for /[lang] — replaces Next's unstyled English default. Triggered
// by notFound() (e.g. sala/[bookingId]) and unmatched routes under a locale.
export default function LangNotFound() {
  const pathname = usePathname()
  const isEs = !pathname?.startsWith('/en')
  const home = isEs ? '/es' : '/en'

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
        {isEs ? 'Volver al inicio →' : 'Back home →'}
      </a>
    </div>
  )
}
