import Link from 'next/link'

// Root 404 — catches any URL that matches no route (including unmatched
// /[lang]/* paths, which never enter a [lang] page render so the localized
// [lang]/not-found.tsx can't reach them). No locale context here, so bilingual +
// branded. In-app notFound() calls from /[lang] pages use [lang]/not-found.tsx.
// Server-rendered (no usePathname) so the copy is in the initial HTML.
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: 'var(--ek-paper)',
      }}
    >
      <p style={{ fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text-muted)', fontSize: 14, letterSpacing: '0.15em', margin: 0 }}>
        404
      </p>
      <h1
        style={{
          fontFamily: 'var(--ek-font-serif)',
          fontSize: 'clamp(34px, 7vw, 56px)',
          lineHeight: 1.05,
          color: 'var(--ek-text)',
          margin: '10px 0 0',
        }}
      >
        Página no encontrada · Page not found
      </h1>
      <p style={{ fontFamily: 'var(--ek-font-sans)', color: 'var(--ek-text-soft)', fontSize: 17, maxWidth: 440, marginTop: 16, lineHeight: 1.5 }}>
        La página que buscas no existe o se movió.<br />
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link
        href="/es"
        style={{ marginTop: 24, color: 'var(--ek-red)', textDecoration: 'none', fontSize: 15, fontFamily: 'var(--ek-font-sans)' }}
      >
        Volver al inicio · Back home →
      </Link>
    </div>
  )
}
