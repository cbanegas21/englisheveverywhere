'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● How it works',
    titleLead: 'Four steps.',
    titleAccent: 'No surprises.',
    side: 'No auto placement test. No marketplace. No group classes. Just your teacher and your schedule.',
    steps: [
      { n: '01', title: 'Choose your pack', body: '8, 12, 16 or 20 classes a month. One payment. No auto-renewal.' },
      { n: '02', title: 'We assign your teacher', body: 'Latin American, near-native. Hand-matched to your level and schedule.' },
      { n: '03', title: 'Book your times', body: 'Whenever you want. 6 a.m. Tuesday, 11 p.m. Sunday. You decide.' },
      { n: '04', title: 'Take your live class', body: '60 minutes, 1 to 1, on video, inside the platform.' },
    ],
  },
  es: {
    eyebrow: '● Cómo funciona',
    titleLead: 'Cuatro pasos.',
    titleAccent: 'Sin sorpresas.',
    side: 'Sin pruebas automáticas. Sin marketplace. Sin clases grupales. Solo tu maestro y tu horario.',
    steps: [
      { n: '01', title: 'Elige tu paquete', body: '8, 12, 16 o 20 clases al mes. Un solo pago. Sin renovación automática.' },
      { n: '02', title: 'Te asignamos un maestro', body: 'Latinoamericano, casi nativo. Emparejado a mano según tu nivel y horario.' },
      { n: '03', title: 'Reserva tus horarios', body: 'Cuando quieras. 6 a.m. del martes, 11 p.m. del domingo. Tú decides.' },
      { n: '04', title: 'Toma tu clase en vivo', body: '60 minutos, 1 a 1, en video, dentro de la plataforma.' },
    ],
  },
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
      <div className="max-w-7xl mx-auto">
        <div
          className="flex flex-col lg:flex-row lg:justify-between lg:items-end"
          style={{ marginBottom: 64, gap: 24 }}
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

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}
        >
          {tx.steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              style={{
                borderTop: '1px solid var(--ek-ink)',
                paddingTop: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 12,
                    color: 'var(--ek-red)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {s.n}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 11,
                    color: 'var(--ek-text-muted)',
                  }}
                >
                  0{i + 1}/04
                </span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 32,
                  letterSpacing: '-0.02em',
                  color: 'var(--ek-text)',
                }}
              >
                {s.title}
              </div>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: 'var(--ek-text-soft)',
                }}
              >
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
