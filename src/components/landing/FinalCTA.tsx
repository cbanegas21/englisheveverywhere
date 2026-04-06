'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    label: 'Ready to start?',
    title: 'Your teacher\nis waiting.',
    body: "Choose your pack today. We'll assign your teacher and have you in class within 48 hours.",
    cta: 'Choose my pack',
    badges: [
      { val: 'No', label: 'subscription' },
      { val: '1×', label: 'payment only' },
      { val: '1:1', label: 'live classes' },
      { val: 'AI', label: 'class summaries' },
    ],
  },
  es: {
    label: '¿Listo para empezar?',
    title: 'Tu maestro\nte está esperando.',
    body: 'Elige tu pack hoy. Te asignamos tu maestro y te tenemos en clase en menos de 48 horas.',
    cta: 'Elegir mi pack',
    badges: [
      { val: 'Sin', label: 'suscripción' },
      { val: '1×', label: 'solo un pago' },
      { val: '1:1', label: 'clases en vivo' },
      { val: 'IA', label: 'resúmenes post-clase' },
    ],
  },
}

export default function FinalCTA({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section style={{ background: '#C41E3A' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-5"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {tx.label}
            </p>
            <h2
              className="font-black whitespace-pre-line mb-6"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', color: '#fff', lineHeight: 1.05 }}
            >
              {tx.title}
            </h2>
            <p className="text-[16px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {tx.body}
            </p>

            <Link
              href={`/${lang}/registro`}
              className="inline-flex items-center justify-center px-8 py-4 rounded text-[14px] font-bold transition-all"
              style={{ background: '#fff', color: '#C41E3A' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#F9F9F9')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#fff')}
            >
              {tx.cta} →
            </Link>
          </motion.div>

          {/* Right — value props */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="grid grid-cols-2 gap-3"
          >
            {tx.badges.map((badge) => (
              <div
                key={badge.label}
                className="rounded p-6"
                style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p className="text-3xl font-black mb-1" style={{ color: '#fff' }}>{badge.val}</p>
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{badge.label}</p>
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  )
}
