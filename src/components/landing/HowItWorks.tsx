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
      { n: '02', title: 'Take your free call', body: 'A quick human call sets your level and goals. Always free.' },
      { n: '03', title: 'Book your times', body: 'Whenever you want — any hour, any day. You pick, 24h ahead.' },
      { n: '04', title: 'We match a teacher — you go live', body: 'We assign an available teacher to each class. 60 min, 1 to 1, on video.' },
    ],
  },
  es: {
    eyebrow: '● Cómo funciona',
    titleLead: 'Cuatro pasos.',
    titleAccent: 'Sin sorpresas.',
    side: 'Sin pruebas automáticas. Sin marketplace. Sin clases grupales. Solo tu maestro y tu horario.',
    steps: [
      { n: '01', title: 'Elige tu paquete', body: '8, 12, 16 o 20 clases al mes. Un solo pago. Sin renovación automática.' },
      { n: '02', title: 'Toma tu llamada gratis', body: 'Una breve llamada humana define tu nivel y tus metas. Siempre gratis.' },
      { n: '03', title: 'Reserva tus horarios', body: 'Cuando quieras — cualquier hora, cualquier día. Tú eliges, con 24h de anticipación.' },
      { n: '04', title: 'Te asignamos maestro y entras en vivo', body: 'Asignamos un maestro disponible a cada clase. 60 min, 1 a 1, en video.' },
    ],
  },
}

// Hand-drawn-feel crimson line icons, one per step (notebook-margin doodle vibe).
const iconProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
const STEP_ICONS = [
  // 01 — choose a pack (stacked cards)
  <svg {...iconProps} key="i1"><rect x="3" y="8" width="12.5" height="11" rx="2" /><path d="M7 8V6.4a2 2 0 0 1 2-2h8.6a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-1.6" /></svg>,
  // 02 — free human call (speech bubble + waveform)
  <svg {...iconProps} key="i2"><path d="M5 4.5h14a1.2 1.2 0 0 1 1.2 1.2v7.6a1.2 1.2 0 0 1-1.2 1.2h-7.4L7 18.5V14.5H5a1.2 1.2 0 0 1-1.2-1.2V5.7A1.2 1.2 0 0 1 5 4.5Z" /><path d="M9 8.7v2.6M12 7.3v5.4M15 8.7v2.6" /></svg>,
  // 03 — pick your hour (calendar with one cell)
  <svg {...iconProps} key="i3"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><rect x="13" y="12.5" width="4" height="4" rx="0.8" fill="currentColor" stroke="none" /></svg>,
  // 04 — go live (video window + play)
  <svg {...iconProps} key="i4"><rect x="3" y="5" width="18" height="13.5" rx="2" /><path d="M3 8.7h18" /><path d="M10.5 11l4.2 2.4-4.2 2.4z" fill="currentColor" stroke="none" /></svg>,
]

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
              <div style={{ color: 'var(--ek-red)', marginBottom: 18 }}>{STEP_ICONS[i]}</div>
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
