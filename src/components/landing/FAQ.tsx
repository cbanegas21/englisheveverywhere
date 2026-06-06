'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

const WHATSAPP_HREF = 'https://wa.me/50488902191'
const WHATSAPP_DISPLAY = '+504 8890-2191'
const SUPPORT_EMAIL = 'hola@englishkolab.com'

const t = {
  en: {
    eyebrow: '● Questions',
    title: 'What you might',
    titleAccent: 'be wondering.',
    contact: {
      kicker: '● Still have a question?',
      lead: 'Talk to a real person',
      leadAccent: 'today.',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Email',
      bestWay: 'Honestly? The best way to get every question answered is to book your',
      bestWayAccent: 'free first class.',
      bestWayEnd: " It's a real placement call with a human — no bots, no pressure, and you'll know exactly where to start.",
      cta: 'Book my free class',
    },
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
    contact: {
      kicker: '● ¿Te quedó una duda?',
      lead: 'Habla con una persona real',
      leadAccent: 'hoy.',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Correo',
      bestWay: '¿La verdad? La mejor forma de resolver todas tus dudas es reservar tu',
      bestWayAccent: 'primera clase gratis.',
      bestWayEnd: ' Es una llamada de nivelación real con una persona — sin bots, sin presión, y sabrás exactamente por dónde empezar.',
      cta: 'Reservar mi clase gratis',
    },
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
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr]"
          style={{
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
                  aria-expanded={open === i}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
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
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
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

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="lk-faq-contact"
              style={{
                marginTop: 40,
                padding: 'clamp(24px, 4vw, 36px)',
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-md, 16px)',
                boxShadow: '0 1px 0 var(--ek-border)',
              }}
            >
              <span className="ek-kicker ek-kicker--red">{tx.contact.kicker}</span>
              <h3
                style={{
                  fontFamily: 'var(--ek-font-sans)',
                  fontWeight: 800,
                  fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  marginTop: 14,
                  color: 'var(--ek-text)',
                }}
              >
                {tx.contact.lead}{' '}
                <span
                  style={{
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: 'var(--ek-red)',
                  }}
                >
                  {tx.contact.leadAccent}
                </span>
              </h3>

              <div className="lk-faq-channels">
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lk-faq-channel"
                  aria-label={`WhatsApp ${WHATSAPP_DISPLAY}`}
                >
                  <span className="lk-faq-channel__icon" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      role="img"
                      focusable="false"
                    >
                      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.71.64.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.02 21.5h-.01c-1.74 0-3.45-.47-4.94-1.35l-.35-.21-3.67.96.98-3.58-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c-.01 5.45-4.45 9.9-9.9 9.9zm8.42-18.32A11.78 11.78 0 0 0 12.02.5C5.46.5.12 5.84.12 12.39c0 2.09.55 4.13 1.59 5.93L.02 24.5l6.32-1.66a11.85 11.85 0 0 0 5.67 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.83 11.83 0 0 0-3.48-8.21z" />
                    </svg>
                  </span>
                  <span className="lk-faq-channel__text">
                    <span className="lk-faq-channel__label">{tx.contact.whatsappLabel}</span>
                    <span className="lk-faq-channel__value">{WHATSAPP_DISPLAY}</span>
                  </span>
                </a>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="lk-faq-channel"
                  aria-label={`${tx.contact.emailLabel} ${SUPPORT_EMAIL}`}
                >
                  <span className="lk-faq-channel__icon" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      role="img"
                      focusable="false"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </span>
                  <span className="lk-faq-channel__text">
                    <span className="lk-faq-channel__label">{tx.contact.emailLabel}</span>
                    <span className="lk-faq-channel__value">{SUPPORT_EMAIL}</span>
                  </span>
                </a>
              </div>

              <p
                style={{
                  marginTop: 24,
                  fontSize: 16,
                  color: 'var(--ek-text-soft)',
                  lineHeight: 1.55,
                }}
              >
                {tx.contact.bestWay}{' '}
                <span style={{ color: 'var(--ek-text)', fontWeight: 600 }}>
                  {tx.contact.bestWayAccent}
                </span>
                {tx.contact.bestWayEnd}
              </p>

              <Link
                href={`/${lang}/registro`}
                className="ek-btn ek-btn-red lk-faq-cta"
                style={{ marginTop: 20, fontSize: 16, padding: '16px 28px' }}
              >
                {tx.contact.cta} →
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        .lk-faq-channels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
        }
        .lk-faq-channel {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid var(--ek-border);
          border-radius: 12px;
          background: var(--ek-paper-warm, #FBF8F3);
          text-decoration: none;
          color: var(--ek-text);
          transition: border-color 0.18s ease, background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
          min-width: 0;
        }
        .lk-faq-channel:hover {
          border-color: var(--ek-red);
          background: var(--ek-card);
          box-shadow: 0 6px 20px var(--ek-red-tint-2, rgba(196,30,58,0.08));
          transform: translateY(-1px);
        }
        .lk-faq-channel:active { transform: translateY(0); }
        .lk-faq-channel__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: var(--ek-red-tint-2, rgba(196,30,58,0.08));
          color: var(--ek-red);
        }
        .lk-faq-channel__text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .lk-faq-channel__label {
          font-family: var(--ek-font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ek-text-muted);
        }
        .lk-faq-channel__value {
          font-family: var(--ek-font-sans);
          font-size: 15px;
          font-weight: 600;
          color: var(--ek-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lk-faq-cta:hover { background: var(--ek-red-hover, #A5172E); }
        @media (max-width: 560px) {
          .lk-faq-channels { grid-template-columns: 1fr; }
          .lk-faq-cta { display: flex; justify-content: center; width: 100%; }
        }
      `}</style>
    </section>
  )
}
