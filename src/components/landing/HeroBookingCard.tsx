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
  const live = lang === 'es' ? 'En vivo' : 'Live'
  const next = lang === 'es' ? 'Próximas horas' : 'Next hours'
  const arrow = lang === 'es' ? 'Reserva una clase' : 'Book a class'
  const note = lang === 'es' ? 'Solo 24 h de anticipación' : 'Only 24 h notice'
  const reserve = lang === 'es' ? 'Reservar' : 'Book'

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
        .lk-bcard {
          background: #fff;
          border: 1px solid var(--ek-border);
          padding: 26px;
          border-radius: var(--ek-radius-lg);
          position: relative;
          overflow: hidden;
          font-family: var(--ek-font-sans);
          box-shadow: 0 24px 48px -32px rgba(0,0,0,0.18);
          transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
        }
        .lk-bcard-link:hover .lk-bcard {
          box-shadow: 0 36px 70px -34px rgba(0,0,0,0.30);
          border-color: var(--ek-border-mid);
          transform: translateY(-3px);
        }
        /* red accent hairline along the top — reads as an intentional surface */
        .lk-bcard::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--ek-red) 0%, var(--ek-red-light) 100%);
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
        .lk-bcard-pulse {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--ek-red);
          box-shadow: 0 0 0 0 rgba(196,30,58,0.5);
          animation: lk-bcard-pulse 2s ease-out infinite;
        }
        @keyframes lk-bcard-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(196,30,58,0.45); }
          70%  { box-shadow: 0 0 0 7px rgba(196,30,58,0); }
          100% { box-shadow: 0 0 0 0 rgba(196,30,58,0); }
        }
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
          .lk-bcard-pulse { animation: none; }
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
              <span className="lk-bcard-pulse" aria-hidden />
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
            <div style={{ display: 'flex', gap: 4, marginTop: 10, alignItems: 'end', justifyContent: 'flex-end' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 8 + ((i * 3) % 18),
                    background: i === 1 ? 'var(--ek-red)' : 'var(--ek-border-mid)',
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Section label */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 10,
            color: 'var(--ek-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          <span style={{ color: 'var(--ek-red)' }}>↳</span>
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
                onMouseEnter={() => setHover(i)}
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
                  {active ? `${live} →` : s.note}
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
