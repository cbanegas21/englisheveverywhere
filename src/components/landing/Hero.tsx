'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import HeroBookingCard from './HeroBookingCard'

const t = {
  en: {
    eyebrow: 'Live English · 1 to 1',
    titleLine1: 'Whenever',
    titleAccent: 'you want.',
    titleLine3: 'Literally whenever you want.',
    body1: 'You pick the time. A class at',
    bodyTime1: '6 a.m.',
    body2: 'before work, or',
    bodyTime2: '11 p.m.',
    body3: 'once the day winds down — you choose. Book 24 hours ahead, any hour, any day.',
    valueLine: 'Your own teacher who knows you — not a crowded class.',
    ctaPrimary: 'Get started',
    ctaSecondary: 'See how it works',
    ctaDashboard: 'Go to my Dashboard',
    statClass: 'Each class',
    statClassValue: '60',
    statClassUnit: 'min',
    statTeacher: 'Your teacher',
    statTeacherValue: '1',
    statTeacherUnit: 'to 1',
    statHours: 'Booking',
    statHoursValue: '24/7',
  },
  es: {
    eyebrow: 'Inglés en vivo · 1 a 1',
    titleLine1: 'Cuando',
    titleAccent: 'quieras.',
    titleLine3: 'Literalmente cuando quieras.',
    body1: 'Tú eliges la hora. Una clase a las',
    bodyTime1: '6 a.m.',
    body2: 'antes del trabajo, o a las',
    bodyTime2: '11 p.m.',
    body3: 'cuando el día termina — tú decides. Reserva con 24 horas de anticipación, cualquier hora, cualquier día.',
    valueLine: 'Tu propio maestro que te conoce — no una clase llena de gente.',
    ctaPrimary: 'Empezar ahora',
    ctaSecondary: 'Ver cómo funciona',
    ctaDashboard: 'Ir a mi Dashboard',
    statClass: 'Cada clase',
    statClassValue: '60',
    statClassUnit: 'min',
    statTeacher: 'Tu maestro',
    statTeacherValue: '1',
    statTeacherUnit: 'a 1',
    statHours: 'Reserva',
    statHoursValue: '24/7',
  },
}

const FADE = {
  hidden: { opacity: 0, y: 10 },
  show: (d: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: d, duration: 0.55, ease: 'easeOut' as const },
  }),
}

export default function Hero({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]

  return (
    <section
      className="lk-hero"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--ek-paper-warm)',
        fontFamily: 'var(--ek-font-sans)',
        color: 'var(--ek-text)',
      }}
    >
      {/* Scoped responsive rules — unique .lk-hero-* prefix, owned by this component */}
      <style>{`
        /* The full-bleed photo: clearly present & intentional on desktop. */
        .lk-hero-photo {
          position: absolute;
          inset: 0;
          background-image: url(/landing/hero-student.jpg);
          background-size: cover;
          background-position: 72% center;
          filter: saturate(1.02) contrast(1.02);
        }
        /* Desktop scrim: cream holds the left headline, opens cleanly to the photo. */
        .lk-hero-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            var(--ek-paper-warm) 0%,
            rgba(251,248,243,0.94) 24%,
            rgba(251,248,243,0.72) 44%,
            rgba(251,248,243,0.30) 66%,
            rgba(251,248,243,0.04) 86%,
            rgba(251,248,243,0) 100%
          );
        }
        .lk-hero-bottomfade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 140px;
          background: linear-gradient(0deg, var(--ek-paper-warm) 0%, rgba(251,248,243,0) 100%);
        }
        /* Stats divider — hidden on mobile where stats wrap to their own rhythm. */
        .lk-hero-stat-div { width: 1px; height: 36px; background: var(--ek-border); }

        @media (max-width: 1023px) {
          /* MOBILE: drop the full-bleed crop entirely (no hair-only blur). A soft
             warm wash keeps the section editorial without fighting the copy. */
          .lk-hero-photo {
            background-image: none;
            background: radial-gradient(120% 80% at 100% 0%, var(--ek-red-tint) 0%, rgba(251,248,243,0) 60%);
            filter: none;
          }
          .lk-hero-scrim { background: none; }
          .lk-hero-inner { padding: 56px 22px 56px !important; }
          .lk-hero-grid { gap: 36px !important; }
          .lk-hero-stats { gap: 0 24px !important; margin-top: 36px !important; }
          .lk-hero-stat-div { display: none; }
          /* Real separation so the stats row and the booking card never collide. */
          .lk-hero-card-col { margin-top: 8px; }
        }
        @media (max-width: 420px) {
          .lk-hero-inner { padding: 48px 18px 48px !important; }
          .lk-hero-stats { gap: 18px 22px !important; }
        }
      `}</style>

      {/* full-bleed hero photo — merged into the page by the cream scrim (desktop) */}
      <div aria-hidden className="lk-hero-photo" />
      {/* cream scrim — holds the headline on the left, opens to the photo on the right */}
      <div aria-hidden className="lk-hero-scrim" />
      {/* bottom fade so the photo dissolves into the next section */}
      <div aria-hidden className="lk-hero-bottomfade" />

      <div
        className="lk-hero-inner max-w-7xl mx-auto"
        style={{ position: 'relative', zIndex: 2, padding: '80px 24px 64px' }}
      >
        <div
          className="lk-hero-grid grid items-end grid-cols-1 lg:grid-cols-[1.25fr_1fr]"
          style={{
            gap: 56,
          }}
        >
          {/* Left: huge headline + body + ctas + stats */}
          <div className="min-w-0">
            <motion.span
              className="ek-kicker ek-kicker--red"
              initial="hidden"
              animate="show"
              custom={0}
              variants={FADE}
            >
              {tx.eyebrow}
            </motion.span>

            <motion.h1
              initial="hidden"
              animate="show"
              custom={0.1}
              variants={FADE}
              style={{
                margin: '28px 0 0',
                fontFamily: 'var(--ek-font-sans)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                letterSpacing: '-0.04em',
                lineHeight: 0.98,
                color: 'var(--ek-text)',
                /* LK-06: keep every glyph crisp where the headline meets the photo */
                textShadow: '0 1px 0 var(--ek-paper-warm), 0 0 24px var(--ek-paper-warm)',
              }}
            >
              {tx.titleLine1}
              <br />
              <span
                style={{
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                  color: 'var(--ek-red)',
                  display: 'inline-block',
                }}
              >
                {tx.titleAccent}
              </span>
              <br />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                  letterSpacing: '-0.03em',
                  display: 'inline-block',
                  color: 'var(--ek-text)',
                }}
              >
                {tx.titleLine3}
              </span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="show"
              custom={0.2}
              variants={FADE}
              style={{
                marginTop: 32,
                fontSize: 18,
                lineHeight: 1.55,
                color: 'var(--ek-text-soft)',
                maxWidth: 520,
              }}
            >
              {tx.body1}{' '}
              <em
                style={{
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                }}
              >
                {tx.bodyTime1}
              </em>{' '}
              {tx.body2}{' '}
              <em
                style={{
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                }}
              >
                {tx.bodyTime2}
              </em>{' '}
              {tx.body3}
            </motion.p>

            {/* Value angle — your own teacher, not a crowded class */}
            <motion.p
              initial="hidden"
              animate="show"
              custom={0.26}
              variants={FADE}
              style={{
                marginTop: 16,
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 10,
                fontSize: 15,
                lineHeight: 1.5,
                fontWeight: 600,
                color: 'var(--ek-text)',
                maxWidth: 520,
              }}
            >
              <span
                aria-hidden
                style={{ color: 'var(--ek-red)', fontWeight: 800, transform: 'translateY(1px)' }}
              >
                ✓
              </span>
              {tx.valueLine}
            </motion.p>

            <motion.div
              initial="hidden"
              animate="show"
              custom={0.3}
              variants={FADE}
              style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}
            >
              {isLoggedIn ? (
                <Link
                  href={`/${lang}/dashboard`}
                  className="ek-btn ek-btn-primary"
                  style={{ padding: '18px 28px', fontSize: 16 }}
                >
                  {tx.ctaDashboard}
                  <span style={{ fontSize: 18 }}>→</span>
                </Link>
              ) : (
                <>
                  <Link
                    href={`/${lang}/registro`}
                    className="ek-btn ek-btn-primary"
                    style={{ padding: '18px 28px', fontSize: 16 }}
                  >
                    {tx.ctaPrimary}
                    <span style={{ fontSize: 18 }}>→</span>
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="ek-btn ek-btn-ghost"
                    style={{ padding: '18px 28px', fontSize: 16 }}
                  >
                    {tx.ctaSecondary}
                  </Link>
                </>
              )}
            </motion.div>

            {/* Inline stats row */}
            <motion.div
              className="lk-hero-stats"
              initial="hidden"
              animate="show"
              custom={0.4}
              variants={FADE}
              style={{ marginTop: 40, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {tx.statClassValue}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--ek-text-muted)',
                      marginLeft: 4,
                    }}
                  >
                    {' '}
                    {tx.statClassUnit}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 4,
                  }}
                >
                  {tx.statClass}
                </div>
              </div>
              <div className="lk-hero-stat-div" />
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {tx.statTeacherValue}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--ek-text-muted)',
                      marginLeft: 4,
                    }}
                  >
                    {' '}
                    {tx.statTeacherUnit}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 4,
                  }}
                >
                  {tx.statTeacher}
                </div>
              </div>
              <div className="lk-hero-stat-div" />
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {tx.statHoursValue}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 4,
                  }}
                >
                  {tx.statHours}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: live booking card (visible on mobile too, clearly separated) */}
          <motion.div
            className="lk-hero-card-col min-w-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.55, ease: 'easeOut' }}
          >
            <HeroBookingCard lang={lang} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
