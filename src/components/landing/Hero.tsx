'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { Boxes } from '@/components/ui/background-boxes'

const t = {
  en: {
    label: 'Live 1-on-1 classes · Latin America',
    title: 'English that\nactually sticks.',
    body: 'Monthly plans of 8–20 live 1-on-1 classes with a bilingual, near-native teacher. Cancel anytime. CEFR-tracked progress every 4 classes.',
    cta: 'See packs & pricing',
    ctaDashboard: 'Go to my Dashboard',
    ctaSecondary: 'How it works',
    trust: ['Cancel anytime', 'Near-native teachers', 'CEFR tracked'],
  },
  es: {
    label: 'Clases 1-a-1 en vivo · Latinoamérica',
    title: 'Inglés que\nrealmente funciona.',
    body: 'Planes mensuales de 8–20 clases 1-a-1 en vivo con un maestro bilingüe near-native. Cancela cuando quieras. Nivel CEFR revisado cada 4 clases.',
    cta: 'Ver packs y precios',
    ctaDashboard: 'Ir a mi Dashboard',
    ctaSecondary: 'Cómo funciona',
    trust: ['Cancela cuando quieras', 'Maestros near-native', 'Nivel CEFR'],
  },
}

const FADE = {
  hidden: { opacity: 0, y: 10 },
  show: (d: number) => ({ opacity: 1, y: 0, transition: { delay: d, duration: 0.55, ease: 'easeOut' as const } }),
}

export default function Hero({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]

  return (
    <section
      className="relative pt-32 pb-28 px-6 overflow-hidden"
      style={{ background: '#111111', minHeight: '92vh', display: 'flex', alignItems: 'center' }}
    >
      {/* Background boxes — subtle isometric grid */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Boxes />
        {/* Radial mask to keep center clear for content */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 10%, rgba(17,17,17,0.75) 60%, #111111 100%)',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10 w-full">
        <div className="max-w-3xl">

          {/* Section label */}
          <motion.p
            className="ee-label mb-5"
            initial="hidden" animate="show" custom={0}
            variants={FADE}
          >
            {tx.label}
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial="hidden" animate="show" custom={0.1}
            variants={FADE}
            className="font-black leading-[1.02] mb-6 whitespace-pre-line"
            style={{
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              color: '#F9F9F9',
              letterSpacing: '-0.03em',
            }}
          >
            {tx.title}
          </motion.h1>

          {/* Body */}
          <motion.p
            initial="hidden" animate="show" custom={0.2}
            variants={FADE}
            className="ee-body-dark max-w-xl mb-10 text-[16px]"
          >
            {tx.body}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial="hidden" animate="show" custom={0.3}
            variants={FADE}
            className="flex flex-col sm:flex-row gap-3 mb-10"
          >
            <Link href={isLoggedIn ? `/${lang}/dashboard` : "#pricing"} className="ee-btn-primary text-[15px] !py-3.5 !px-8">
              {isLoggedIn ? tx.ctaDashboard : tx.cta}
            </Link>
            <Link href="#how-it-works" className="ee-btn-ghost text-[15px] !py-3.5 !px-8">
              {tx.ctaSecondary} →
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial="hidden" animate="show" custom={0.4}
            variants={FADE}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            {tx.trust.map((item) => (
              <span
                key={item}
                className="text-[13px] font-medium flex items-center gap-2"
                style={{ color: 'rgba(249,249,249,0.45)' }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#C41E3A' }}
                />
                {item}
              </span>
            ))}
          </motion.div>

        </div>
      </div>

      {/* Bottom fade to next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #F9F9F9)' }}
      />
    </section>
  )
}
