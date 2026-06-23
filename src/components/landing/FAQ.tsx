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
    eyebrow: 'Questions',
    title: 'What you might',
    titleAccent: 'be wondering.',
    contact: {
      kicker: 'Still have a question?',
      lead: 'Talk to a real person',
      leadAccent: 'today.',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Email',
      bestWay: 'Honestly? The best way to get every question answered is to book your',
      bestWayAccent: 'free diagnostic call.',
      bestWayEnd: ' You meet a real teacher, find your level and build your plan — no bots, no pressure, no card.',
      cta: 'Book my free call',
    },
    items: [
      { q: 'Is the first class really free?', a: 'Yes. Your first class is a free diagnostic call — you meet your teacher, find your level and map out a plan. No card, no commitment.' },
      { q: 'How do I book my first class?', a: 'Sign up, book your free diagnostic call, and when you’re ready, choose a pack and book any hour you like.' },
      { q: 'What level do I need to start?', a: 'Any level, from A0 to C2. Your free diagnostic call sets your level and where to begin.' },
      { q: 'Do classes expire?', a: "No. Once you've bought them, they're yours, with no deadlines. Even so, we recommend following your plan and taking your classes consistently — that's how real progress happens." },
      { q: 'Can I choose my teacher?', a: "We match you with a teacher based on your level and goals — usually the same one each class, so you build a rhythm. If your teacher isn't free at the time you picked, another available teacher covers that class." },
      { q: 'Can I cancel or reschedule a class?', a: 'Yes — reschedule with at least 24 hours’ notice. Classes cancelled with less than 24 hours notice are forfeited.' },
      { q: 'Do I need Zoom or Google Meet?', a: 'No. Live classes happen right inside the platform, on 1-to-1 video.' },
      { q: 'How long is each class?', a: 'Sixty minutes. 1 to 1, live, with your assigned teacher.' },
      { q: 'Can I book at any hour?', a: 'Yes — any time of day, any day of the week. You just need 24 hours of advance notice.' },
      { q: 'What currency do I pay in?', a: 'Charges run through Stripe in USD. We show the local equivalent in 20+ currencies.' },
    ],
  },
  es: {
    eyebrow: 'Preguntas',
    title: 'Lo que',
    titleAccent: 'quizás te preguntas.',
    contact: {
      kicker: '¿Te quedó una duda?',
      lead: 'Habla con una persona real',
      leadAccent: 'hoy.',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Correo',
      bestWay: '¿La verdad? La mejor forma de resolver todas tus dudas es reservar tu',
      bestWayAccent: 'llamada de diagnóstico gratis.',
      bestWayEnd: ' Conoces a un maestro de verdad, descubres tu nivel y armas tu plan — sin bots, sin presión, sin tarjeta.',
      cta: 'Reservar mi llamada gratis',
    },
    items: [
      { q: '¿La primera clase es de verdad gratis?', a: 'Sí. Tu primera clase es una llamada de diagnóstico gratis — conoces a tu maestro, descubres tu nivel y armas un plan. Sin tarjeta, sin compromiso.' },
      { q: '¿Cómo reservo mi primera clase?', a: 'Te registras, reservas tu llamada de diagnóstico gratis y, cuando estés listo, eliges un paquete y reservas a la hora que quieras.' },
      { q: '¿Qué nivel necesito para empezar?', a: 'Cualquiera, de A0 a C2. Tu llamada de diagnóstico gratis define tu nivel y por dónde empezar.' },
      { q: '¿Las clases caducan?', a: 'No. Una vez compradas, son tuyas para siempre, sin fechas límite. Aun así, te recomendamos seguir tu plan y tomar tus clases con constancia: así es como se ve el progreso de verdad.' },
      { q: '¿Puedo elegir a mi maestro?', a: 'Te asignamos un maestro según tu nivel y metas — normalmente el mismo en cada clase, para que tomes ritmo. Si tu maestro no está libre a la hora que elegiste, otro maestro disponible cubre esa clase.' },
      { q: '¿Puedo cancelar o reprogramar una clase?', a: 'Sí — reprograma con al menos 24 horas de anticipación. Las clases canceladas con menos de 24h se pierden.' },
      { q: '¿Necesito Zoom o Meet?', a: 'No. Las clases en vivo ocurren dentro de la plataforma, en video 1 a 1.' },
      { q: '¿Cuánto duran las clases?', a: 'Sesenta minutos cada una. 1 a 1, en vivo, con tu maestro asignado.' },
      { q: '¿Puedo reservar a cualquier hora?', a: 'Sí. Cualquier hora del día, cualquier día de la semana. Solo 24 horas de anticipación.' },
      { q: '¿En qué moneda pago?', a: 'El cargo se hace en USD vía Stripe. Mostramos el equivalente en más de 20 monedas locales.' },
    ],
  },
}

// Real, recognizable channel marks (Carlos: people should know it's WhatsApp /
// email). The WhatsApp glyph keeps its brand green; email is a clean envelope.
function WhatsAppMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 360 362" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
      <path
        fill="#25D366"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M307.546 52.566C273.709 18.684 228.706.017 180.756 0 81.951 0 1.538 80.404 1.504 179.235c-.017 31.594 8.242 62.432 23.928 89.609L0 361.736l95.024-24.925c26.179 14.285 55.659 21.805 85.655 21.814h.077c98.788 0 179.21-80.413 179.244-179.244.017-47.898-18.608-92.926-52.454-126.807v-.008Zm-126.79 275.788h-.06c-26.73-.008-52.952-7.194-75.831-20.765l-5.44-3.231-56.391 14.791 15.05-54.981-3.542-5.638c-14.912-23.721-22.793-51.139-22.776-79.286.035-82.14 66.867-148.973 149.051-148.973 39.793.017 77.198 15.53 105.328 43.695 28.131 28.157 43.61 65.596 43.593 105.398-.035 82.149-66.867 148.982-148.982 148.982v.008Zm81.719-111.577c-4.478-2.243-26.497-13.073-30.606-14.568-4.108-1.496-7.09-2.243-10.073 2.243-2.982 4.487-11.568 14.577-14.181 17.559-2.613 2.991-5.226 3.361-9.704 1.117-4.477-2.243-18.908-6.97-36.02-22.226-13.313-11.878-22.304-26.54-24.916-31.027-2.613-4.486-.275-6.91 1.959-9.136 2.011-2.011 4.478-5.234 6.721-7.847 2.244-2.613 2.983-4.486 4.478-7.469 1.496-2.991.748-5.603-.369-7.847-1.118-2.243-10.073-24.289-13.812-33.253-3.636-8.732-7.331-7.546-10.073-7.692-2.613-.13-5.595-.155-8.586-.155-2.991 0-7.839 1.118-11.947 5.604-4.108 4.486-15.677 15.324-15.677 37.361s16.047 43.344 18.29 46.335c2.243 2.991 31.585 48.225 76.51 67.632 10.684 4.615 19.029 7.374 25.535 9.437 10.727 3.412 20.49 2.931 28.208 1.779 8.604-1.289 26.498-10.838 30.228-21.298 3.73-10.46 3.73-19.433 2.613-21.298-1.117-1.865-4.108-2.991-8.586-5.234l.008-.017Z"
      />
    </svg>
  )
}

function EnvelopeMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ek-text-muted)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export default function FAQ({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="lk-section-y"
      style={{
        background: 'var(--ek-paper)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="lk-shell">
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr]"
          style={{
            gap: 'clamp(40px, 6vw, 80px)',
          }}
        >
          <div className="lk-faq-aside">
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

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="lk-faq-contact"
              style={{
                marginTop: 32,
                padding: 'clamp(24px, 4vw, 36px)',
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
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
                  <span className="lk-faq-channel__top">
                    <WhatsAppMark />
                    <span className="ek-microlabel lk-faq-channel__label">
                      {tx.contact.whatsappLabel}
                    </span>
                  </span>
                  <span className="lk-faq-channel__value">{WHATSAPP_DISPLAY}</span>
                </a>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="lk-faq-channel"
                  aria-label={`${tx.contact.emailLabel} ${SUPPORT_EMAIL}`}
                >
                  <span className="lk-faq-channel__top">
                    <EnvelopeMark />
                    <span className="ek-microlabel lk-faq-channel__label">
                      {tx.contact.emailLabel}
                    </span>
                  </span>
                  <span className="lk-faq-channel__value">{SUPPORT_EMAIL}</span>
                </a>
              </div>

              <p className="ek-body" style={{ marginTop: 24 }}>
                {tx.contact.bestWay}{' '}
                <span style={{ color: 'var(--ek-text)', fontWeight: 600 }}>
                  {tx.contact.bestWayAccent}
                </span>
                {tx.contact.bestWayEnd}
              </p>

              <Link
                href={`/${lang}/registro`}
                className="ek-btn ek-btn-red ek-btn--lg lk-faq-cta"
                style={{ marginTop: 20 }}
              >
                {tx.contact.cta} →
              </Link>
            </motion.div>
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
                      <p className="ek-body" style={{ marginTop: 12 }}>
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

      <style>{`
        .lk-faq-aside {
          align-self: start;
        }
        @media (min-width: 1024px) {
          .lk-faq-aside {
            position: sticky;
            top: 96px;
          }
        }
        .lk-faq-channels {
          display: flex;
          flex-direction: column;
          margin-top: 26px;
          border-top: 1px solid var(--ek-border-mid);
        }
        .lk-faq-channel {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 16px 0;
          border-bottom: 1px solid var(--ek-border);
          text-decoration: none;
          color: var(--ek-text);
          min-width: 0;
          transition: padding-left 0.2s ease;
        }
        .lk-faq-channel:hover {
          padding-left: 8px;
        }
        .lk-faq-channel__top {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .lk-faq-channel:hover .lk-faq-channel__value {
          color: var(--ek-red);
        }
        .lk-faq-channel__label {
          transition: color 0.18s ease;
        }
        .lk-faq-channel:hover .lk-faq-channel__label {
          color: var(--ek-red);
        }
        .lk-faq-channel__value {
          font-family: var(--ek-font-mono);
          font-size: clamp(1rem, 1.4vw, 1.15rem);
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--ek-text);
          word-break: break-word;
          overflow-wrap: anywhere;
          transition: color 0.18s ease;
        }
        .lk-faq-cta:hover { background: var(--ek-red-hover, #A5172E); }
        @media (max-width: 560px) {
          .lk-faq-cta { display: flex; justify-content: center; width: 100%; }
        }
      `}</style>
    </section>
  )
}
