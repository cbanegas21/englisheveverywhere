'use client'

import { useEffect } from 'react'

// Route-level error boundary for the /sala classroom. If anything in the room
// tree throws during render, show a calm branded retry INSTEAD of a blank
// teardown — the blank teardown previously read to users as "it kicked me out
// of the call." reset() re-renders the segment → VideoRoomClient re-inits →
// re-checks access and rejoins (or shows the proper ended/expired screen).
export default function SalaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[sala] route error boundary:', error)
  }, [error])

  // This boundary renders outside the locale provider, so infer language from the
  // path (default Spanish, the app's primary locale).
  const isEs =
    typeof window === 'undefined' ? true : !window.location.pathname.startsWith('/en/')

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0a0c0f',
        color: '#fff',
        padding: 24,
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
        {isEs ? 'Algo salió mal en la sala' : 'Something went wrong in the room'}
      </h1>
      <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
        {isEs
          ? 'Tu clase sigue activa. Vuelve a entrar para reconectarte.'
          : 'Your class is still active. Rejoin to reconnect.'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '12px 24px',
          borderRadius: 10,
          background: '#C41E3A',
          color: '#fff',
          border: 0,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {isEs ? 'Volver a entrar' : 'Rejoin'}
      </button>
    </div>
  )
}
