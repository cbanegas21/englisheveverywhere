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

function Half({ ariaHidden }: { ariaHidden?: boolean }) {
  // One full pass of COUNTRIES. Inter-item rhythm is owned by each item's
  // margin (not a flex `gap`), so the track is exactly two identical Halves
  // back-to-back — the trailing margin on the last item of Half A equals the
  // leading rhythm before Half B, and translateX(-50%) wraps on the exact
  // boundary with no stutter.
  return (
    <div
      className="lk2-trust-half"
      aria-hidden={ariaHidden || undefined}
      style={{ display: 'flex', flexShrink: 0 }}
    >
      {COUNTRIES.map((c, i) => (
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
            marginRight: 40,
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
  )
}

export default function TrustStrip({ lang: _lang }: { lang: Locale }) {
  return (
    <section
      className="lk2-trust"
      style={{
        background: 'var(--ek-ink)',
        padding: '18px 0',
        overflow: 'hidden',
      }}
    >
      <div
        className="lk2-trust-track"
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'marquee 60s linear infinite',
          whiteSpace: 'nowrap',
          willChange: 'transform',
        }}
      >
        {/* Two byte-identical halves; -50% lands exactly on the seam. */}
        <Half />
        <Half ariaHidden />
      </div>

      <style>{`
        .lk2-trust {
          /* Fade flags at both edges instead of slicing mid-word. */
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0,
            #000 9%,
            #000 91%,
            transparent 100%
          );
          mask-image: linear-gradient(
            to right,
            transparent 0,
            #000 9%,
            #000 91%,
            transparent 100%
          );
        }
        @media (prefers-reduced-motion: reduce) {
          .lk2-trust-track { animation: none; }
        }
      `}</style>
    </section>
  )
}
