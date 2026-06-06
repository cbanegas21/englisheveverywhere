'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: 'Start today',
    titleLead: 'Your first class',
    titleMid: 'can be',
    titleAccent: 'today.',
    body: "Or tomorrow at 5 a.m. Or Saturday at midnight.",
    bodyEnd: 'You decide.',
    cta: 'Get started',
    ctaGhost: 'Free discovery class',
    ctaNote: 'New here? Start with a free discovery class — meet a real teacher, find your level. No card needed.',
    ctaDashboard: 'Go to my Dashboard',
    ctaBook: 'Book your next class',
  },
  es: {
    eyebrow: 'Empieza hoy',
    titleLead: 'Tu primera clase',
    titleMid: 'puede ser',
    titleAccent: 'hoy.',
    body: 'O mañana a las 5 a.m. O el sábado a la medianoche.',
    bodyEnd: 'Tú decides.',
    cta: 'Empezar ahora',
    ctaGhost: 'Clase de descubrimiento gratis',
    ctaNote: '¿Nuevo por aquí? Empieza con una clase de descubrimiento gratis — conoce a un maestro de verdad y descubre tu nivel. Sin tarjeta.',
    ctaDashboard: 'Ir a mi Dashboard',
    ctaBook: 'Agenda tu próxima clase',
  },
}

export default function FinalCTA({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]

  return (
    <section
      style={{
        background: 'var(--ek-ink)',
        color: '#fff',
        paddingBlock: 'clamp(88px, 12vw, 132px)',
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
      <div className="lk-shell relative" style={{ zIndex: 2 }}>
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
            className="ek-body-large"
            style={{
              marginTop: 24,
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 560,
            }}
          >
            {tx.body}
          </p>
          {/* Deliberate second line — a serif-italic punchline, not a forced
              <br/> wedged into the running sentence. */}
          <p
            style={{
              marginTop: 10,
              fontFamily: 'var(--ek-font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: '#fff',
            }}
          >
            {tx.bodyEnd}
          </p>
          <div
            className="lk-finalcta-actions"
            style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap', alignItems: 'center' }}
          >
            {isLoggedIn ? (
              <>
                <Link
                  href={`/${lang}/dashboard`}
                  className="ek-btn ek-btn--lg lk-finalcta-btn"
                  style={{
                    background: 'var(--ek-red)',
                    color: '#fff',
                  }}
                >
                  {tx.ctaDashboard} →
                </Link>
                {/* Restrained secondary so the logged-in row isn't one
                    stranded pill — a quiet text link, not a second loud CTA. */}
                <Link
                  href={`/${lang}/dashboard/agendar`}
                  className="lk-finalcta-textlink"
                >
                  {tx.ctaBook} →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/${lang}/registro`}
                  className="ek-btn ek-btn--lg lk-finalcta-btn"
                  style={{
                    background: 'var(--ek-red)',
                    color: '#fff',
                  }}
                >
                  {tx.cta} →
                </Link>
                <Link
                  href={`/${lang}/registro?intent=discovery`}
                  className="ek-btn ek-btn--lg ek-btn-ghost--on-dark lk-finalcta-btn"
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
        .lk-finalcta-textlink {
          font-family: var(--ek-font-sans);
          font-weight: 600;
          font-size: 15px;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          padding: 6px 4px;
          border-bottom: 1px solid rgba(255,255,255,0.22);
          line-height: 1.2;
          transition: color 0.18s ease, border-color 0.18s ease;
        }
        .lk-finalcta-textlink:hover,
        .lk-finalcta-textlink:focus-visible {
          color: #fff;
          border-color: rgba(255,255,255,0.6);
        }
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
          .lk-finalcta-textlink {
            text-align: center;
            align-self: center;
          }
        }
      `}</style>
    </section>
  )
}
