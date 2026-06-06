'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● How it works',
    titleLead: 'Four steps.',
    titleAccent: 'No surprises.',
    side: 'No auto placement test. No marketplace. No group classes. Just your own teacher and your own schedule.',
    pathLabel: 'Sign up → first class',
    steps: [
      {
        n: '01',
        title: 'Choose your pack',
        body: '8, 12, 16 or 20 classes a month. One payment — no auto-renewal, and the classes never expire.',
        tag: 'One-time payment',
      },
      {
        n: '02',
        title: 'Take your free call',
        body: 'A real person, not a quiz. A short human call sets your level and goals before you spend a thing.',
        tag: 'Always free',
      },
      {
        n: '03',
        title: 'Book your times',
        body: 'Any hour, any day, on your terms. You pick each slot at least 24h ahead — around work, school or family.',
        tag: 'You decide',
      },
      {
        n: '04',
        title: 'We assign your teacher — you go live',
        body: 'After you book, we assign an available teacher to your class. 60 minutes, just the two of you, live on video.',
        tag: '1-to-1, 60 min',
      },
    ],
  },
  es: {
    eyebrow: '● Cómo funciona',
    titleLead: 'Cuatro pasos.',
    titleAccent: 'Sin sorpresas.',
    side: 'Sin pruebas automáticas. Sin marketplace. Sin clases grupales. Solo tu propio maestro y tu propio horario.',
    pathLabel: 'Te registras → primera clase',
    steps: [
      {
        n: '01',
        title: 'Elige tu paquete',
        body: '8, 12, 16 o 20 clases al mes. Un solo pago — sin renovación automática, y las clases nunca caducan.',
        tag: 'Pago único',
      },
      {
        n: '02',
        title: 'Toma tu llamada gratis',
        body: 'Una persona real, no un test. Una breve llamada humana define tu nivel y tus metas antes de gastar nada.',
        tag: 'Siempre gratis',
      },
      {
        n: '03',
        title: 'Reserva tus horarios',
        body: 'Cualquier hora, cualquier día, a tu manera. Eliges cada horario con 24h de anticipación — alrededor del trabajo, los estudios o la familia.',
        tag: 'Tú decides',
      },
      {
        n: '04',
        title: 'Te asignamos maestro y entras en vivo',
        body: 'Después de reservar, asignamos un maestro disponible a tu clase. 60 minutos, solo ustedes dos, en vivo por video.',
        tag: '1 a 1, 60 min',
      },
    ],
  },
}

// Hand-drawn-feel crimson line icons, one per step (notebook-margin doodle vibe).
const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
function StepIcon({ i }: { i: number }) {
  switch (i) {
    case 0: // choose a pack (stacked cards)
      return <svg {...iconProps}><rect x="3" y="8" width="12.5" height="11" rx="2" /><path d="M7 8V6.4a2 2 0 0 1 2-2h8.6a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-1.6" /></svg>
    case 1: // free human call (speech bubble + waveform)
      return <svg {...iconProps}><path d="M5 4.5h14a1.2 1.2 0 0 1 1.2 1.2v7.6a1.2 1.2 0 0 1-1.2 1.2h-7.4L7 18.5V14.5H5a1.2 1.2 0 0 1-1.2-1.2V5.7A1.2 1.2 0 0 1 5 4.5Z" /><path d="M9 8.7v2.6M12 7.3v5.4M15 8.7v2.6" /></svg>
    case 2: // pick your hour (calendar with one cell)
      return <svg {...iconProps}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><rect x="13" y="12.5" width="4" height="4" rx="0.8" fill="currentColor" stroke="none" /></svg>
    default: // go live (video window + play)
      return <svg {...iconProps}><rect x="3" y="5" width="18" height="13.5" rx="2" /><path d="M3 8.7h18" /><path d="M10.5 11l4.2 2.4-4.2 2.4z" fill="currentColor" stroke="none" /></svg>
  }
}

export default function HowItWorks({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section
      id="how-it-works"
      style={{
        background: 'var(--ek-paper-warm)',
        padding: '96px clamp(24px, 6vw, 80px)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <style>{`
        .lk-how-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        /* The crimson connector line threading the four steps. */
        .lk-how-connector {
          position: absolute;
          background: var(--ek-red-tint-3);
          z-index: 0;
        }
        /* Mobile: vertical spine down the left, threading the number discs
           (disc centre sits at 22px card padding + 20px half-disc = ~42px). */
        .lk-how-connector {
          left: 41px;
          top: 44px;
          bottom: 44px;
          width: 2px;
          height: auto;
        }
        @media (min-width: 880px) {
          .lk-how-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
          /* Desktop: horizontal rail spanning the disc centres (first card
             centre ≈ 12.5% to last ≈ 87.5%), threading through each disc. */
          .lk-how-connector {
            left: 12.5%;
            right: 12.5%;
            top: 43px;
            bottom: auto;
            width: auto;
            height: 2px;
          }
        }
        .lk-how-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        @media (hover: hover) {
          .lk-how-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 22px 44px -34px rgba(0,0,0,0.28);
            border-color: var(--ek-border-mid);
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div
          className="flex flex-col lg:flex-row lg:justify-between lg:items-end"
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
                fontWeight: 800,
                fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
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
            {tx.side}
          </p>
        </div>

        {/* Path label — frames the four steps as a single journey. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {tx.pathLabel}
          </span>
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              height: 1,
              background:
                'repeating-linear-gradient(90deg, var(--ek-border-mid) 0 6px, transparent 6px 12px)',
            }}
          />
        </motion.div>

        <div style={{ position: 'relative' }}>
          <span aria-hidden="true" className="lk-how-connector" />

          <div className="lk-how-grid">
            {tx.steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="lk-how-card"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.45 }}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  background: 'var(--ek-card)',
                  border: '1px solid var(--ek-border)',
                  borderRadius: 'var(--ek-radius-lg)',
                  padding: '24px 22px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  {/* Numbered crimson disc — the node the connector passes through. */}
                  <span
                    style={{
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--ek-red)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      boxShadow: '0 0 0 5px var(--ek-card), 0 0 0 6px var(--ek-red-tint-3)',
                    }}
                  >
                    {s.n}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 11,
                      color: 'var(--ek-text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    0{i + 1}/04
                  </span>
                </div>

                {/* Crimson line icon in its own tinted plate. */}
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: 22,
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--ek-radius-sm)',
                    background: 'var(--ek-red-tint-2)',
                    color: 'var(--ek-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StepIcon i={i} />
                </span>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginTop: 18,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.18,
                    color: 'var(--ek-text)',
                  }}
                >
                  {s.title}
                </div>
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: 'var(--ek-text-soft)',
                  }}
                >
                  {s.body}
                </p>

                {/* Supporting chip — distilled takeaway for the step. */}
                <span
                  style={{
                    marginTop: 'auto',
                    paddingTop: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-red)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--ek-red)',
                    }}
                  />
                  {s.tag}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
