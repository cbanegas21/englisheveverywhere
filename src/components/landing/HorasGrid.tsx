'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: 'Schedule',
    titleLead: '168 hours in a week.',
    titleAccent: "All of them are yours.",
    sideLine: 'Book 24 hours ahead. Any time of day. Any day of the week.',
    clockLabel: 'Local time',
    clockCaption: 'Someone, somewhere in Latin America, is learning English.',
    sample: 'sample · 10 classes booked at different hours throughout the month',
    legend: 'booked',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  es: {
    eyebrow: 'Horario',
    titleLead: '168 horas a la semana.',
    titleAccent: 'Todas son tuyas.',
    sideLine: 'Reserva con 24 horas de anticipación. Cualquier hora del día. Cualquier día de la semana.',
    clockLabel: 'Hora local',
    clockCaption: 'Alguien, en algún lugar de Latinoamérica, está aprendiendo inglés.',
    sample: 'ejemplo · 10 clases reservadas en distintas horas a lo largo del mes',
    legend: 'reservado',
    days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  },
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!now) return <span style={{ visibility: 'hidden' }}>00:00</span>
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return (
    <span>
      {hh}:{mm}
      <span style={{ opacity: 0.55 }}>:{ss}</span>
    </span>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const BOOKED = new Set([
  '0-7',
  '1-6',
  '2-22',
  '3-12',
  '4-19',
  '5-23',
  '6-9',
  '1-21',
  '3-5',
  '5-11',
])

export default function HorasGrid({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section
      className="lk-section-y lk-horas"
      style={{
        background: 'var(--ek-paper)',
        fontFamily: 'var(--ek-font-sans)',
        borderTop: '1px solid var(--ek-border)',
      }}
    >
      <style>{`
        /* ── Column geometry (shared between heatmap + axis) ──────────
           Day-label gutter + 24 equal hour columns + the same inner gap,
           so the bottom axis ticks land on TRUE column edges instead of
           justify-between + magic padding. */
        .lk-horas {
          --lk-gutter: 36px;
          --lk-gap: 3px;
          --lk-cols: repeat(24, minmax(0, 1fr));
        }
        .lk-horas-card {
          background: #fff;
          border: 1px solid var(--ek-border);
          padding: 32px;
          border-radius: var(--ek-radius-lg);
          max-width: 760px;
        }
        .lk-horas-grid {
          display: grid;
          grid-template-columns: var(--lk-gutter) var(--lk-cols);
          gap: var(--lk-gap);
          font-family: var(--ek-font-mono);
          font-size: 9px;
          color: var(--ek-text-muted);
        }
        .lk-horas-day {
          display: flex;
          align-items: center;
          color: #7A6A55;
          font-size: 10px;
        }
        .lk-horas-cell {
          aspect-ratio: 1 / 1;
          border-radius: 2px;
        }
        /* Axis: same gutter + 24 columns so ticks land on TRUE column edges.
           Gutter spacer + four labelled ticks (span 6 each) fill all 24
           columns; the "24h" marker is pinned to the right content edge so
           it never dangles past the grid. */
        .lk-horas-axis {
          position: relative;
          display: grid;
          grid-template-columns: var(--lk-gutter) var(--lk-cols);
          gap: var(--lk-gap);
          margin-top: 14px;
          font-family: var(--ek-font-mono);
          font-size: 10px;
          color: var(--ek-text-muted);
        }
        .lk-horas-tick {
          grid-column: span 6;
          position: relative;
        }
        .lk-horas-tick::before {
          content: '';
          position: absolute;
          top: -7px;
          left: 0;
          width: 1px;
          height: 4px;
          background: var(--ek-border-mid);
        }
        .lk-horas-tick--end {
          position: absolute;
          top: 0;
          right: 0;
          text-align: right;
        }
        .lk-horas-tick--end::before {
          content: '';
          position: absolute;
          top: -7px;
          right: 0;
          width: 1px;
          height: 4px;
          background: var(--ek-border-mid);
        }
        /* Mobile: 24 cells at 390px would be ~7.5px wide — far too small to
           label. Keep the dense grid purely as TEXTURE (drop the in-cell
           hour numbers) and let the bottom axis carry the scale. */
        @media (max-width: 640px) {
          .lk-horas-card { padding: 18px 16px; max-width: none; }
          .lk-horas { --lk-gutter: 28px; --lk-gap: 2px; }
          .lk-horas-grid { font-size: 8px; }
          .lk-horas-day { font-size: 8.5px; }
          .lk-horas-cell { border-radius: 1.5px; }
          .lk-horas-axis { font-size: 9px; margin-top: 12px; }
        }
        /* Tablet (≈768): two-column row — schedule keeps its width, the
           clock becomes a narrow side column instead of a full-bleed banner. */
        @media (min-width: 641px) and (max-width: 1023px) {
          .lk-horas-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 220px;
            gap: 16px;
            align-items: stretch;
          }
          .lk-horas-card { max-width: none; }
          .lk-horas-clock { min-height: 100%; }
        }
      `}</style>
      <div className="lk-shell">
        <div
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between"
          style={{ marginBottom: 56, gap: 24 }}
        >
          <div>
            <span className="ek-kicker ek-kicker--red">{tx.eyebrow}</span>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{
                fontFamily: 'var(--ek-font-sans)',
                fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.0,
                marginTop: 16,
                color: 'var(--ek-text)',
              }}
            >
              {tx.titleLead}
              <br />
              <span
                style={{
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                }}
              >
                {tx.titleAccent}
              </span>
            </motion.h2>
          </div>
          <p className="ek-body" style={{ maxWidth: 360 }}>
            {tx.sideLine}
          </p>
        </div>

        <div
          className="lk-horas-row grid grid-cols-1 lg:grid-cols-[1fr_280px]"
          style={{
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {/* Grid card — single hour scale: heatmap rows above, one aligned
              axis below. No in-grid top number row. */}
          <div className="lk-horas-card">
            <div className="lk-horas-grid">
              {tx.days.map((d, di) => (
                <div key={`row-${di}`} style={{ display: 'contents' }}>
                  <div className="lk-horas-day">{d}</div>
                  {HOURS.map((h) => {
                    const key = `${di}-${h}`
                    const isBooked = BOOKED.has(key)
                    return (
                      <div
                        key={key}
                        className="lk-horas-cell"
                        style={{
                          background: isBooked ? 'var(--ek-red)' : '#EFE6D7',
                          boxShadow: isBooked ? 'none' : 'inset 0 0 0 1px #E5D9C5',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="lk-horas-axis" aria-hidden="true">
              {/* gutter spacer aligns first tick with the heatmap columns */}
              <span />
              <span className="lk-horas-tick">00h</span>
              <span className="lk-horas-tick">06h</span>
              <span className="lk-horas-tick">12h</span>
              <span className="lk-horas-tick">18h</span>
              {/* right-edge marker: zero-flow, pinned to the grid's end */}
              <span className="lk-horas-tick--end">24h</span>
            </div>
          </div>

          {/* Clock photo */}
          <div
            className="lk-horas-clock"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--ek-radius-lg)',
              backgroundImage: 'url(/landing/clock.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minHeight: 280,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(17,17,17,0.15) 0%, rgba(17,17,17,0.75) 100%)',
                mixBlendMode: 'multiply',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10,
                  color: '#fff',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                {tx.clockLabel}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 26,
                  color: '#fff',
                  marginTop: 6,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  fontFeatureSettings: '"tnum"',
                }}
              >
                <LiveClock />
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#fff',
                  marginTop: 10,
                  opacity: 0.85,
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                }}
              >
                {tx.clockCaption}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 18px',
            fontSize: 12,
            color: 'var(--ek-text-muted)',
            fontFamily: 'var(--ek-font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {/* editorial legend — keys the heatmap as real data */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: 'var(--ek-red)',
                display: 'inline-block',
              }}
            />
            {tx.legend}
          </span>
          <span aria-hidden="true" style={{ color: 'var(--ek-border-mid)' }}>—</span>
          <span>{tx.sample}</span>
        </div>
      </div>
    </section>
  )
}
