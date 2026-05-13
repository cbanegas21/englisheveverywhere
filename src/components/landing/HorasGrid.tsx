'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● Schedule',
    titleLead: '168 hours in a week.',
    titleAccent: "All of them are yours.",
    sideLine: 'Book 24 hours ahead. Any time of day. Any day of the week.',
    clockLabel: '↳ Local time',
    clockTime: '03:24',
    clockCaption: 'Someone, somewhere in Latin America, is learning English.',
    sample: '↳ sample · 10 classes booked at different hours throughout the month',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  es: {
    eyebrow: '● Horario',
    titleLead: '168 horas a la semana.',
    titleAccent: 'Todas son tuyas.',
    sideLine: 'Reserva con 24 horas de anticipación. Cualquier hora del día. Cualquier día de la semana.',
    clockLabel: '↳ Hora local',
    clockTime: '03:24',
    clockCaption: 'Alguien, en algún lugar de Latinoamérica, está aprendiendo inglés.',
    sample: '↳ ejemplo · 10 clases reservadas en distintas horas a lo largo del mes',
    days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  },
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
      style={{
        background: 'var(--ek-paper-warm)',
        padding: '120px clamp(24px, 6vw, 80px) 64px',
        fontFamily: 'var(--ek-font-sans)',
        borderTop: '1px solid var(--ek-border)',
      }}
    >
      <div className="max-w-7xl mx-auto">
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
          <p
            style={{
              maxWidth: 360,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ek-text-soft)',
            }}
          >
            {tx.sideLine}
          </p>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: '1fr 280px',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {/* Grid card */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--ek-border)',
              padding: 32,
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '36px repeat(24, 1fr)',
                gap: 3,
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 9,
                color: 'var(--ek-text-muted)',
              }}
            >
              <div />
              {HOURS.map((h) => (
                <div
                  key={`hh-${h}`}
                  style={{ textAlign: 'center', paddingBottom: 6, color: '#A89682' }}
                >
                  {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
                </div>
              ))}
              {tx.days.map((d, di) => (
                <div key={`row-${di}`} style={{ display: 'contents' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: '#7A6A55',
                      fontSize: 10,
                    }}
                  >
                    {d}
                  </div>
                  {HOURS.map((h) => {
                    const key = `${di}-${h}`
                    const isBooked = BOOKED.has(key)
                    return (
                      <div
                        key={key}
                        style={{
                          aspectRatio: '1/1',
                          background: isBooked ? 'var(--ek-red)' : '#EFE6D7',
                          borderRadius: 2,
                          boxShadow: isBooked ? 'none' : 'inset 0 0 0 1px #E5D9C5',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                paddingLeft: 39,
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                color: 'var(--ek-text-muted)',
              }}
            >
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>24h</span>
            </div>
          </div>

          {/* Clock photo */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 4,
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
                  fontSize: 22,
                  color: '#fff',
                  marginTop: 6,
                  fontWeight: 500,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {tx.clockTime}
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

        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: 'var(--ek-text-muted)',
            fontFamily: 'var(--ek-font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {tx.sample}
        </p>
      </div>
    </section>
  )
}
