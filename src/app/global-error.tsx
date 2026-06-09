'use client'

// Top-level boundary — only fires when the ROOT layout itself throws, so it must
// render its own <html>/<body> and cannot rely on globals.css (it may not have
// loaded). Hardcoded brand colors + bilingual (no locale context here).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#F4EFE6', color: '#111111', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '48px 24px',
          }}
        >
          <h1 style={{ fontSize: 'clamp(34px, 7vw, 56px)', lineHeight: 1.1, margin: 0 }}>
            Algo salió mal · Something went wrong
          </h1>
          <p style={{ color: '#5C5648', fontSize: 17, maxWidth: 440, marginTop: 16, lineHeight: 1.5 }}>
            Tuvimos un problema inesperado. Por favor intenta de nuevo.<br />
            We hit an unexpected problem. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 26,
              background: '#111111',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 26px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Intentar de nuevo · Try again
          </button>
        </div>
      </body>
    </html>
  )
}
