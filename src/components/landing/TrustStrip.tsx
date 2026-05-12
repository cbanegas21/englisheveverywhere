'use client'

import type { Locale } from '@/lib/i18n/translations'

const COUNTRIES = [
  'México',
  'Honduras',
  'Guatemala',
  'El Salvador',
  'Costa Rica',
  'Colombia',
  'Argentina',
  'Chile',
  'Brasil',
  'Perú',
  'Ecuador',
  'Panamá',
]

const items = [...COUNTRIES, ...COUNTRIES]

export default function TrustStrip({ lang: _lang }: { lang: Locale }) {
  return (
    <section
      style={{
        background: 'var(--ek-ink)',
        padding: '20px 0',
        overflow: 'hidden',
        borderTop: '1px solid var(--ek-ink)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 48,
          animation: 'marquee 40s linear infinite',
          whiteSpace: 'nowrap',
          paddingLeft: 48,
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
              gap: 12,
              color: '#fff',
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                background: 'var(--ek-red)',
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
            {c}
          </span>
        ))}
      </div>
    </section>
  )
}
