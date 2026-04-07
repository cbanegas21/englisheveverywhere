'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    label: 'The team',
    title: 'Teachers who genuinely care\nabout your progress',
    body: 'All our teachers go through a rigorous selection process. They are bilingual, certified, and passionate about teaching English in a personalized way.',
    cards: [
      {
        icon: '🏆',
        title: 'Certified teachers',
        desc: 'Every teacher holds a recognized teaching certification and meets a CEFR C1 minimum.',
      },
      {
        icon: '🎯',
        title: 'Personalized approach',
        desc: 'No cookie-cutter lessons. Every class is adapted to your goals, level, and pace.',
      },
      {
        icon: '⭐',
        title: 'Quality guaranteed',
        desc: 'We monitor every teaching relationship and act quickly if standards slip.',
      },
    ],
  },
  es: {
    label: 'El equipo',
    title: 'Maestros que realmente se\npreocupan por tu progreso',
    body: 'Todos nuestros maestros pasan por un riguroso proceso de selección. Son bilingües, certificados y apasionados por enseñar inglés de manera personalizada.',
    cards: [
      {
        icon: '🏆',
        title: 'Maestros certificados',
        desc: 'Cada maestro tiene una certificación de enseñanza reconocida y cumple con un mínimo de C1 en el CEFR.',
      },
      {
        icon: '🎯',
        title: 'Enfoque personalizado',
        desc: 'Sin lecciones genéricas. Cada clase se adapta a tus objetivos, nivel y ritmo.',
      },
      {
        icon: '⭐',
        title: 'Calidad garantizada',
        desc: 'Monitoreamos cada relación de enseñanza y actuamos rápido si los estándares bajan.',
      },
    ],
  },
}

export default function Teachers({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section id="teachers" style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <motion.p
            className="ee-label-light mb-5"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            {tx.label}
          </motion.p>

          <motion.h2
            className="font-black whitespace-pre-line mb-6"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#111111', lineHeight: 1.1 }}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.05, duration: 0.5 }}
          >
            {tx.title}
          </motion.h2>

          <motion.p
            className="ee-body max-w-lg mx-auto"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ delay: 0.1 }}
          >
            {tx.body}
          </motion.p>
        </div>

        {/* 3 icon cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {tx.cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="rounded-xl p-7 text-center"
              style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="text-[40px] mb-4 leading-none">{card.icon}</div>
              <h3 className="text-[15px] font-black mb-2" style={{ color: '#111111' }}>
                {card.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#6B7280' }}>
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
