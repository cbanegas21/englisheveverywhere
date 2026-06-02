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
      style={{
        background: 'var(--ek-paper-warm)',
        padding: '80px 24px 64px',
        fontFamily: 'var(--ek-font-sans)',
        color: 'var(--ek-text)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="grid items-end"
          style={{
            gridTemplateColumns: '1.25fr 1fr',
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

            <motion.div
              initial="hidden"
              animate="show"
              custom={0.3}
              variants={FADE}
              style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap' }}
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
              <div style={{ width: 1, height: 36, background: 'var(--ek-border)' }} />
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
              <div style={{ width: 1, height: 36, background: 'var(--ek-border)' }} />
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

          {/* Right: live booking card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.55, ease: 'easeOut' }}
            className="hidden lg:block min-w-0"
          >
            <HeroBookingCard lang={lang} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
