'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● Start today',
    titleLead: 'Your first class',
    titleMid: 'can be',
    titleAccent: 'today.',
    body: "Or tomorrow at 5 a.m. Or Saturday at midnight.",
    bodyEnd: 'You decide.',
    cta: 'Get started',
    ctaGhost: 'Free diagnostic call',
    ctaNote: 'Not sure of your level? Book a free call with a real teacher first — no card needed.',
    ctaDashboard: 'Go to my Dashboard',
  },
  es: {
    eyebrow: '● Empieza hoy',
    titleLead: 'Tu primera clase',
    titleMid: 'puede ser',
    titleAccent: 'hoy.',
    body: 'O mañana a las 5 a.m. O el sábado a la medianoche.',
    bodyEnd: 'Tú decides.',
    cta: 'Empezar ahora',
    ctaGhost: 'Llamada de diagnóstico gratis',
    ctaNote: '¿No sabes tu nivel? Agenda primero una llamada gratis con un profesor de verdad — sin tarjeta.',
    ctaDashboard: 'Ir a mi Dashboard',
  },
}

export default function FinalCTA({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]

  return (
    <section
      style={{
        background: 'var(--ek-ink)',
        color: '#fff',
        padding: '140px clamp(24px, 6vw, 80px)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/landing/evening.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.7) 50%, rgba(17,17,17,0.4) 100%)',
        }}
      />
      <div className="max-w-7xl mx-auto relative" style={{ zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span
            className="ek-kicker"
            style={{ color: 'var(--ek-red-light, #E8526A)' }}
          >
            {tx.eyebrow}
          </span>
          <h2
            style={{
              fontFamily: 'var(--ek-font-sans)',
              fontWeight: 800,
              fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
              letterSpacing: '-0.035em',
              lineHeight: 1.0,
              marginTop: 20,
              color: '#fff',
            }}
          >
            {tx.titleLead}
            <br />
            {tx.titleMid}{' '}
            <span
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--ek-red-light, #E8526A)',
              }}
            >
              {tx.titleAccent}
            </span>
          </h2>
          <p
            style={{
              marginTop: 24,
              fontSize: 20,
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 560,
              lineHeight: 1.5,
            }}
          >
            {tx.body}
            <br />
            {tx.bodyEnd}
          </p>
          <div
            className="lk-finalcta-actions"
            style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap', alignItems: 'center' }}
          >
            {isLoggedIn ? (
              <Link
                href={`/${lang}/dashboard`}
                className="ek-btn lk-finalcta-btn"
                style={{
                  background: 'var(--ek-red)',
                  color: '#fff',
                  fontSize: 18,
                  padding: '20px 32px',
                }}
              >
                {tx.ctaDashboard} →
              </Link>
            ) : (
              <>
                <Link
                  href={`/${lang}/registro`}
                  className="ek-btn lk-finalcta-btn"
                  style={{
                    background: 'var(--ek-red)',
                    color: '#fff',
                    fontSize: 18,
                    padding: '20px 32px',
                  }}
                >
                  {tx.cta} →
                </Link>
                <Link
                  href={`/${lang}/registro?intent=diagnostic`}
                  className="ek-btn ek-btn-ghost--on-dark lk-finalcta-btn"
                  style={{ fontSize: 18, padding: '20px 32px' }}
                >
                  {tx.ctaGhost}
                </Link>
              </>
            )}
          </div>
          {!isLoggedIn && (
            <p
              className="lk-finalcta-note"
              style={{
                marginTop: 18,
                fontSize: 14,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.6)',
                maxWidth: 440,
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              {tx.ctaNote}
            </p>
          )}
        </motion.div>
      </div>
      <style>{`
        @media (max-width: 520px) {
          .lk-finalcta-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .lk-finalcta-btn {
            width: 100%;
            justify-content: center;
            text-align: center;
          }
        }
      `}</style>
    </section>
  )
}
