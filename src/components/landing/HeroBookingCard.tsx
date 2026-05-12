'use client'

import { useEffect, useState } from 'react'
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
    { day: 'Domingo', time: '23:00', note: 'Tarde noche' },
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
  const list = slots[lang]
  const label = lang === 'es' ? 'Ahora mismo' : 'Right now'
  const next = lang === 'es' ? 'Próximas horas' : 'Next hours'
  const arrow = lang === 'es' ? '↳ Reserva una clase' : '↳ Book a class'
  const note = lang === 'es' ? '· solo 24 h de anticipación' : '· only 24 h notice'
  const reserve = lang === 'es' ? 'RESERVAR →' : 'BOOK →'

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--ek-border)',
        padding: 28,
        borderRadius: 4,
        position: 'relative',
        boxShadow: '0 24px 48px -32px rgba(0,0,0,0.18)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--ek-border)',
        }}
      >
        <div>
          <div
            style={{
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
              marginTop: 6,
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
          <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'end' }}>
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

      <div
        style={{
          marginTop: 20,
          fontFamily: 'var(--ek-font-mono)',
          fontSize: 10,
          color: 'var(--ek-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        {arrow}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
        {list.map((s, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr auto',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              background: hover === i ? 'var(--ek-ink)' : 'var(--ek-paper-warm)',
              color: hover === i ? '#fff' : 'var(--ek-text)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 12,
                color: hover === i ? '#bbb' : 'var(--ek-text-muted)',
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
              style={{
                fontSize: 12,
                color: hover === i ? '#bbb' : 'var(--ek-text-muted)',
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
              }}
            >
              {s.note}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 20,
          borderTop: '1px solid var(--ek-border)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{note}</span>
        <span
          style={{
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 11,
            color: 'var(--ek-red)',
            letterSpacing: '0.06em',
          }}
        >
          {reserve}
        </span>
      </div>
    </div>
  )
}
