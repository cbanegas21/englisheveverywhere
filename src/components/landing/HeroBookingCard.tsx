'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

const slots = {
  en: [
    { day: 'Today', time: '4:00 PM', note: 'In 2 hours' },
    { day: 'Tomorrow', time: '6:00 AM', note: 'Before work' },
    { day: 'Tomorrow', time: '10:00 PM', note: 'After dinner' },
    { day: 'Saturday', time: '8:00 AM', note: 'Weekend' },
    { day: 'Sunday', time: '11:00 PM', note: 'Late night' },
  ],
  es: [
    { day: 'Hoy', time: '16:00', note: 'En 2 horas' },
    { day: 'Mañana', time: '06:00', note: 'Antes del trabajo' },
    { day: 'Mañana', time: '22:00', note: 'Después de cenar' },
    { day: 'Sábado', time: '08:00', note: 'Fin de semana' },
    { day: 'Domingo', time: '23:00', note: 'Ya de noche' },
  ],
}

function LiveClock() {
  const [t, setT] = useState<Date | null>(null)
  useEffect(() => {
    setT(new Date())
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!t) return <span style={{ visibility: 'hidden' }}>00:00:00</span>
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')
  const ss = String(t.getSeconds()).padStart(2, '0')
  return (
    <span>
      {hh}:{mm}
      <span style={{ color: 'var(--ek-text-muted)' }}>:{ss}</span>
    </span>
  )
}

export default function HeroBookingCard({ lang }: { lang: Locale }) {
  const [hover, setHover] = useState(1)
  const [cardHover, setCardHover] = useState(false)
  const list = slots[lang]

  const label = lang === 'es' ? 'Ahora mismo' : 'Right now'
  const next = lang === 'es' ? 'Horarios típicos' : 'Typical hours'
  const arrow = lang === 'es' ? 'Reserva una clase' : 'Book a class'
  const note = lang === 'es' ? 'Solo 24 h de anticipación' : 'Only 24 h notice'
  const reserve = lang === 'es' ? 'Reservar' : 'Book'
  // These slots are illustrative, not a live feed — label them honestly so the
  // card never reads as fabricated real-time availability.
  const sample = lang === 'es' ? 'ejemplo' : 'sample'
  const pick = lang === 'es' ? 'Tú eliges →' : 'You pick →'

  return (
    <Link
      href={`/${lang}/registro`}
      aria-label={arrow}
      className="lk-bcard-link"
      onMouseEnter={() => setCardHover(true)}
      onMouseLeave={() => setCardHover(false)}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
    >
      <style>{`
        /* printed-schedule-card: one hairline border, a quiet shadow, no accent bar */
        .lk-bcard {
          background: #fff;
          border: 1px solid var(--ek-border);
          padding: 26px;
          border-radius: var(--ek-radius-lg);
          position: relative;
          overflow: hidden;
          font-family: var(--ek-font-sans);
          box-shadow: 0 10px 30px -26px rgba(0,0,0,0.14);
          transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
        }
        .lk-bcard-link:hover .lk-bcard {
          box-shadow: 0 18px 40px -30px rgba(0,0,0,0.18);
          border-color: var(--ek-border-mid);
          transform: translateY(-2px);
        }
        .lk-bcard-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--ek-ink);
          color: #fff;
          font-family: var(--ek-font-mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 16px;
          border-radius: var(--ek-radius-sm);
          transition: background 0.2s ease, gap 0.2s ease;
        }
        .lk-bcard-link:hover .lk-bcard-cta { background: var(--ek-red); gap: 11px; }
        @media (max-width: 1023px) {
          .lk-bcard { padding: 22px; }
        }
        @media (max-width: 420px) {
          .lk-bcard { padding: 18px; }
          .lk-bcard-slot { grid-template-columns: 76px 1fr auto !important; padding: 12px 13px !important; }
          .lk-bcard-slot-note { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lk-bcard, .lk-bcard-link:hover .lk-bcard, .lk-bcard-cta { transition: none; }
        }
      `}</style>

      <div className="lk-bcard">
        {/* Header: live clock + availability heartbeat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingBottom: 18,
            borderBottom: '1px solid var(--ek-border)',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                color: 'var(--ek-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 28,
                marginTop: 8,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--ek-text)',
                fontFeatureSettings: '"tnum"',
              }}
            >
              <LiveClock />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                color: 'var(--ek-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {next}
            </div>
            {/* Honest 'sample' tag — these are illustrative slots, not a live
                availability feed. Mirrors HorasGrid's 'ejemplo · sample' cue. */}
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                marginTop: 9,
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-faint)',
              }}
            >
              {sample}
            </div>
          </div>
        </div>

        {/* Section label — hairline red lead-in instead of an ↳ glyph */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 10,
            color: 'var(--ek-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          <span
            aria-hidden
            style={{ flex: '0 0 auto', width: 18, height: 1, background: 'var(--ek-red)' }}
          />
          {arrow}
        </div>

        {/* Slot list */}
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          {list.map((s, i) => {
            const active = hover === i
            return (
              <div
                key={i}
                className="lk-bcard-slot"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 15px',
                  borderRadius: 'var(--ek-radius-sm)',
                  cursor: 'pointer',
                  background: active ? 'var(--ek-ink)' : 'var(--ek-paper-warm)',
                  color: active ? '#fff' : 'var(--ek-text)',
                  border: `1px solid ${active ? 'var(--ek-ink)' : 'var(--ek-border)'}`,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 12,
                    color: active ? 'rgba(255,255,255,0.62)' : 'var(--ek-text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {s.day}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {s.time}
                </span>
                <span
                  className="lk-bcard-slot-note"
                  style={{
                    fontSize: 12,
                    color: active ? 'rgba(255,255,255,0.7)' : 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                  }}
                >
                  {active ? pick : s.note}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer: notice + real BOOK affordance */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            paddingTop: 18,
            borderTop: '1px solid var(--ek-border)',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--ek-text-muted)',
              fontFamily: 'var(--ek-font-serif)',
              fontStyle: 'italic',
            }}
          >
            {note}
          </span>
          <span className="lk-bcard-cta" aria-hidden>
            {reserve}
            <span style={{ transform: cardHover ? 'translateX(2px)' : 'none', transition: 'transform 0.2s ease' }}>
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
