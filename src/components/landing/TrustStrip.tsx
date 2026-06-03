'use client'

import type { Locale } from '@/lib/i18n/translations'

// Latin-American countries we serve, with ISO codes for real SVG flags
// (flag-icons; CSS loaded globally in app/layout.tsx). Emoji flags don't render
// on Windows, so we never use them.
const COUNTRIES: { name: string; cc: string }[] = [
  { name: 'México', cc: 'mx' },
  { name: 'Guatemala', cc: 'gt' },
  { name: 'Honduras', cc: 'hn' },
  { name: 'El Salvador', cc: 'sv' },
  { name: 'Nicaragua', cc: 'ni' },
  { name: 'Costa Rica', cc: 'cr' },
  { name: 'Panamá', cc: 'pa' },
  { name: 'Colombia', cc: 'co' },
  { name: 'Venezuela', cc: 've' },
  { name: 'Ecuador', cc: 'ec' },
  { name: 'Perú', cc: 'pe' },
  { name: 'Bolivia', cc: 'bo' },
  { name: 'Chile', cc: 'cl' },
  { name: 'Argentina', cc: 'ar' },
  { name: 'Paraguay', cc: 'py' },
  { name: 'Uruguay', cc: 'uy' },
  { name: 'Brasil', cc: 'br' },
  { name: 'República Dominicana', cc: 'do' },
  { name: 'Cuba', cc: 'cu' },
  { name: 'Puerto Rico', cc: 'pr' },
]

// Doubled so the -50% marquee loops seamlessly.
const items = [...COUNTRIES, ...COUNTRIES]

export default function TrustStrip({ lang: _lang }: { lang: Locale }) {
  return (
    <section
      style={{
        background: 'var(--ek-ink)',
        padding: '18px 0',
        overflow: 'hidden',
        borderTop: '1px solid var(--ek-ink)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 40,
          animation: 'marquee 60s linear infinite',
          whiteSpace: 'nowrap',
          paddingLeft: 40,
          willChange: 'transform',
        }}
      >
        {items.map((c, i) => (
          <span
            key={i}
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <span
              className={`fi fi-${c.cc}`}
              aria-hidden
              style={{ fontSize: 18, lineHeight: 1, borderRadius: 2, boxShadow: '0 0 0 1px rgba(255,255,255,0.14)' }}
            />
            {c.name}
          </span>
        ))}
      </div>
    </section>
  )
}
