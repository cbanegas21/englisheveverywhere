'use client'

import { usePathname } from 'next/navigation'

// Localized error boundary for everything under /[lang]. Without it, a thrown
// error (or a Server Action failure that bubbles) shows Next's unstyled English
// default page. Minimal + typographic to match the editorial brand.
export default function LangError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
      <h1
        style={{
          fontFamily: 'var(--ek-font-serif)',
          fontSize: 'clamp(40px, 8vw, 68px)',
          lineHeight: 1.05,
          color: 'var(--ek-text)',
          margin: 0,
        }}
      >
        {isEs ? 'Algo salió mal' : 'Something went wrong'}
      </h1>
      <p
        style={{
          fontFamily: 'var(--ek-font-sans)',
          color: 'var(--ek-text-soft)',
          fontSize: 17,
          maxWidth: 440,
          marginTop: 18,
          lineHeight: 1.5,
        }}
      >
        {isEs
          ? 'Tuvimos un problema al cargar esta página. Puedes intentar de nuevo o volver al inicio.'
          : 'We hit a problem loading this page. You can try again or head back home.'}
      </p>
      <div style={{ display: 'flex', gap: 22, marginTop: 28, alignItems: 'center', fontFamily: 'var(--ek-font-sans)' }}>
        <button
          onClick={reset}
          style={{
            background: 'var(--ek-ink)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {isEs ? 'Intentar de nuevo' : 'Try again'}
        </button>
        <a href={home} style={{ color: 'var(--ek-red)', textDecoration: 'none', fontSize: 15 }}>
          {isEs ? 'Volver al inicio' : 'Back home'}
        </a>
      </div>
    </div>
  )
}
