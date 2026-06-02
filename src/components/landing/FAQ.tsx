'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● Questions',
    title: 'What you might',
    titleAccent: 'be wondering.',
    items: [
      { q: 'Do classes expire?', a: "No. Once you've bought them, they're yours. No deadlines, ever." },
      { q: 'Can I choose my teacher?', a: "We match you with a teacher based on your level and goals — usually the same one each class, so you build a rhythm. If your teacher isn't free at the time you picked, another available teacher covers that class." },
      { q: 'Do I need Zoom or Google Meet?', a: 'No. Live classes happen right inside the platform, on 1-to-1 video.' },
      { q: 'How long is each class?', a: 'Sixty minutes. 1 to 1, live, with your assigned teacher.' },
      { q: 'Can I book at any hour?', a: 'Yes — any time of day, any day of the week. You just need 24 hours of advance notice.' },
      { q: 'What currency do I pay in?', a: 'Charges run through Stripe in USD. We show the local equivalent in 20+ currencies.' },
    ],
  },
  es: {
    eyebrow: '● Preguntas',
    title: 'Lo que',
    titleAccent: 'quizás te preguntas.',
    items: [
      { q: '¿Las clases caducan?', a: 'No. Una vez compradas, son tuyas para siempre. Sin fechas límite.' },
      { q: '¿Puedo elegir a mi maestro?', a: 'Te asignamos un maestro según tu nivel y metas — normalmente el mismo en cada clase, para que tomes ritmo. Si tu maestro no está libre a la hora que elegiste, otro maestro disponible cubre esa clase.' },
      { q: '¿Necesito Zoom o Meet?', a: 'No. Las clases en vivo ocurren dentro de la plataforma, en video 1 a 1.' },
      { q: '¿Cuánto duran las clases?', a: 'Sesenta minutos cada una. 1 a 1, en vivo, con tu maestro asignado.' },
      { q: '¿Puedo reservar a cualquier hora?', a: 'Sí. Cualquier hora del día, cualquier día de la semana. Solo 24 horas de anticipación.' },
      { q: '¿En qué moneda pago?', a: 'El cargo se hace en USD vía Stripe. Mostramos el equivalente en más de 20 monedas locales.' },
    ],
  },
}

export default function FAQ({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section
      id="faq"
      style={{
        background: 'var(--ek-paper)',
        padding: '96px clamp(24px, 6vw, 80px)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: '1fr 1.6fr',
            gap: 'clamp(40px, 6vw, 80px)',
          }}
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
                lineHeight: 1.1,
                marginTop: 16,
                color: 'var(--ek-text)',
              }}
            >
              {tx.title}{' '}
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

          <div>
            {tx.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                style={{
                  borderTop: i === 0 ? '1px solid var(--ek-ink)' : 'none',
                  borderBottom: '1px solid var(--ek-border)',
                  padding: '24px 0',
                }}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    cursor: 'pointer',
                    listStyle: 'none',
                    fontSize: 18,
                    fontWeight: 600,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    textAlign: 'left',
                    color: 'var(--ek-text)',
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                >
                  <span>{item.q}</span>
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      color: 'var(--ek-red)',
                      fontSize: 18,
                      transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                      transition: 'transform 0.18s ease',
                      display: 'inline-block',
                    }}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p
                        style={{
                          marginTop: 12,
                          fontSize: 16,
                          color: 'var(--ek-text-soft)',
                          lineHeight: 1.55,
                        }}
                      >
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
