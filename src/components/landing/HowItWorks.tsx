'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: 'How it works',
    titleLead: 'Four steps.',
    titleAccent: 'No surprises.',
    side: 'No auto placement test. No marketplace. No group classes. Just your own teacher and your own schedule.',
    pathLabel: 'Sign up → first class',
    steps: [
      {
        n: '01',
        title: 'Take your free diagnostic call',
        body: 'A real person, not a quiz. A short human call sets your level and goals before you spend a thing.',
        tag: 'Always free',
      },
      {
        n: '02',
        title: 'Choose your pack',
        body: '8, 12, 16 or 20 classes a month. One payment — no auto-renewal, and the classes never expire.',
        tag: 'One-time payment',
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
    eyebrow: 'Cómo funciona',
    titleLead: 'Cuatro pasos.',
    titleAccent: 'Sin sorpresas.',
    side: 'Sin pruebas automáticas. Sin marketplace. Sin clases grupales. Solo tu propio maestro y tu propio horario.',
    pathLabel: 'Te registras → primera clase',
    steps: [
      {
        n: '01',
        title: 'Toma tu llamada de diagnóstico gratis',
        body: 'Una persona real, no un test. Una breve llamada humana define tu nivel y tus metas antes de gastar nada.',
        tag: 'Siempre gratis',
      },
      {
        n: '02',
        title: 'Elige tu paquete',
        body: '8, 12, 16 o 20 clases al mes. Un solo pago — sin renovación automática, y las clases nunca caducan.',
        tag: 'Pago único',
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

export default function HowItWorks({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section
      id="how-it-works"
      className="lk-section-y"
      style={{
        background: 'var(--ek-paper-warm)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <style>{`
        .lk-how-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
          border-top: 1px solid var(--ek-border-mid);
        }
        .lk-how-card {
          position: relative;
          padding: 30px 0 30px;
          border-bottom: 1px solid var(--ek-border);
        }
        /* Tablet: tidy 2×2 — each row's lower border, each right column inset. */
        @media (min-width: 600px) {
          .lk-how-grid {
            grid-template-columns: repeat(2, 1fr);
            column-gap: 40px;
          }
          .lk-how-card {
            padding: 30px 0 30px;
          }
          /* Drop the doubled bottom rule on the final pair so the grid reads
             as a clean ledger, not a stack of boxes. */
          .lk-how-card:nth-last-child(-n+2) {
            border-bottom: 1px solid var(--ek-border);
          }
        }
        /* Desktop: the four steps read left-to-right as one ledger row. */
        @media (min-width: 1040px) {
          .lk-how-grid {
            grid-template-columns: repeat(4, 1fr);
            column-gap: 44px;
            border-bottom: 1px solid var(--ek-border-mid);
          }
          .lk-how-card {
            padding: 36px 0 38px;
            border-bottom: none;
          }
        }
        .lk-how-numeral {
          font-family: var(--ek-font-serif);
          font-style: italic;
          font-weight: 400;
          font-size: clamp(3rem, 6vw, 4rem);
          line-height: 0.9;
          letter-spacing: -0.02em;
          color: var(--ek-red);
        }
      `}</style>

      <div className="lk-shell">
        <div
          className="flex flex-col lg:flex-row lg:justify-between lg:items-end"
          style={{ marginBottom: 48, gap: 24 }}
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
          <p className="ek-body" style={{ maxWidth: 360 }}>
            {tx.side}
          </p>
        </div>

        {/* Journey label — one quiet line, no dashed gimmick rail. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 4 }}
        >
          <span
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-text-muted)',
            }}
          >
            {tx.pathLabel}
          </span>
        </motion.div>

        <div className="lk-how-grid">
          {tx.steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="lk-how-card"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.45 }}
            >
              {/* Large serif-italic numeral — the card's focal mark. */}
              <div className="lk-how-numeral">{s.n}</div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 18,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.18,
                  color: 'var(--ek-text)',
                  minHeight: '2.36em',
                }}
              >
                {s.title}
              </div>
              <p className="ek-body" style={{ marginTop: 10 }}>
                {s.body}
              </p>

              {/* Distilled takeaway — quiet mono label, no dot, no pin. */}
              <span
                style={{
                  display: 'block',
                  marginTop: 16,
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-red)',
                  fontWeight: 600,
                }}
              >
                {s.tag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
