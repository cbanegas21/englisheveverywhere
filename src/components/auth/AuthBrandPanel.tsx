import { Check } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'

/**
 * Shared dark "ink" editorial panel for the auth pages (registro + login).
 * Mirrors the landing's Cálido Editorial DNA: dark hero card, mono kicker,
 * Geist display headline with an Instrument Serif italic crimson accent,
 * crimson-tinted value props, and a mono stat row. Hidden below `lg`.
 */

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

const copy = {
  en: {
    kicker: 'Live English · 1 to 1',
    lead: 'Learn English',
    accent: 'whenever you want.',
    sub: 'You pick the time. Book 24 hours ahead — any hour, any day — and meet a teacher matched to your level and goals.',
    benefits: ['Live 1-on-1 classes', 'A teacher matched to your level', 'Pay once per pack — no auto-renewal'],
  },
  es: {
    kicker: 'Inglés en vivo · 1 a 1',
    lead: 'Aprende inglés',
    accent: 'cuando quieras.',
    sub: 'Tú eliges la hora. Reserva con 24 h de anticipación —cualquier hora, cualquier día— y conecta con un maestro asignado a tu nivel.',
    benefits: ['Clases 1 a 1 en vivo', 'Maestro asignado a tu nivel', 'Pago único por paquete, sin renovación'],
  },
}

export function AuthBrandPanel({ lang }: { lang: Locale }) {
  const c = copy[lang]
  return (
    <aside
      className="hidden lg:flex relative overflow-hidden flex-col justify-center"
      style={{ background: 'var(--ek-ink)', color: 'var(--ek-on-dark)', padding: '48px 52px' }}
    >
      {/* photo — warm autumn desk; bright and clearly visible, especially the subject (woman + MacBook) on the RIGHT */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/loginimage.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: '78% 38%',
          filter: 'saturate(0.96) brightness(1.05) contrast(1.02)',
        }}
      />
      {/* scrim A — horizontal: holds the LEFT dark for the cream text, then opens to clear on the RIGHT so the photo reads */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(100deg, rgba(17,17,17,0.92) 0%, rgba(17,17,17,0.82) 30%, rgba(17,17,17,0.52) 55%, rgba(17,17,17,0.18) 80%, rgba(17,17,17,0) 100%)',
        }}
      />
      {/* scrim B — vertical: gentle ink at the top (logo) and bottom edges; light through the middle so the photo reads behind the centered text */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(17,17,17,0.42) 0%, rgba(17,17,17,0.06) 30%, rgba(17,17,17,0.06) 70%, rgba(17,17,17,0.45) 100%)',
        }}
      />
      {/* brand glows — crimson top-right + faint cream bottom-left, riding over the photo */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 520px at 100% -5%, rgba(196,30,58,0.22), transparent 60%)' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(680px 480px at -5% 105%, rgba(244,239,230,0.05), transparent 55%)' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url("${NOISE}")`, opacity: 0.05, mixBlendMode: 'overlay' }} />

      {/* logo — pinned top-left */}
      <div style={{ position: 'absolute', top: 48, left: 52, zIndex: 1, animation: 'fade-up 0.6s ease both' }}>
        <Logo onDark href={`/${lang}`} size={30} />
      </div>

      {/* pitch — vertically centered */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
        <span className="ek-kicker ek-kicker--on-dark" style={{ animation: 'fade-up 0.6s ease both', animationDelay: '0.05s' }}>
          {c.kicker}
        </span>
        <h2
          style={{
            margin: '22px 0 0', fontFamily: 'var(--ek-font-sans)', fontWeight: 800,
            fontSize: 'clamp(2.3rem, 2.9vw, 3.1rem)', letterSpacing: '-0.035em', lineHeight: 1.02,
            animation: 'fade-up 0.6s ease both', animationDelay: '0.1s',
          }}
        >
          {c.lead}
          <br />
          <span
            style={{
              fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400,
              letterSpacing: '-0.02em', color: 'var(--ek-red-light)',
              fontSize: 'clamp(2.6rem, 3.3vw, 3.5rem)',
            }}
          >
            {c.accent}
          </span>
        </h2>
        <p
          style={{
            marginTop: 22, fontSize: 15.5, lineHeight: 1.6, color: 'var(--ek-on-dark-soft)', maxWidth: 400,
            animation: 'fade-up 0.6s ease both', animationDelay: '0.15s',
          }}
        >
          {c.sub}
        </p>
        <ul style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fade-up 0.6s ease both', animationDelay: '0.2s' }}>
          {c.benefits.map(b => (
            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14.5, color: 'var(--ek-on-dark)' }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: 'rgba(196,30,58,0.22)', border: '1px solid rgba(196,30,58,0.42)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Check className="w-3 h-3" style={{ color: 'var(--ek-red-light)' }} />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
