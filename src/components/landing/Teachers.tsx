'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    label: 'The team',
    title: 'Bilingual.\nNear-native.\nHonduran.',
    body: 'Every teacher is hand-selected. All speak fluent English with a near-native accent — and because they are from Honduras, they understand exactly why you struggle, what works, and how to explain it so it actually clicks.',
    stats: [
      { val: '100%', label: 'Near-native English' },
      { val: 'C1–C2', label: 'CEFR minimum' },
      { val: 'HN', label: 'Based in Honduras' },
    ],
    active: 'Accepting students',
    soon: 'Coming soon',
  },
  es: {
    label: 'El equipo',
    title: 'Bilingüe.\nNear-native.\nHondureño.',
    body: 'Cada maestro es seleccionado a mano. Todos hablan inglés fluido con acento near-native — y como son de Honduras, entienden exactamente por qué te cuesta, qué funciona y cómo explicarlo para que realmente te haga clic.',
    stats: [
      { val: '100%', label: 'Inglés near-native' },
      { val: 'C1–C2', label: 'Nivel CEFR mínimo' },
      { val: 'HN', label: 'Basados en Honduras' },
    ],
    active: 'Aceptando estudiantes',
    soon: 'Próximamente',
  },
}

function getTeachers(lang: Locale) {
  const soon = lang === 'en' ? 'Coming Soon' : 'Próximamente'
  return [
    {
      initials: 'LB',
      name: 'Lesly B.',
      level: 'CEFR C2',
      tags: lang === 'en'
        ? ['Business English', 'IELTS prep', 'Conversation']
        : ['Inglés de negocios', 'Preparación IELTS', 'Conversación'],
      active: true,
    },
    { initials: '–', name: soon, level: 'CEFR C1+', tags: [], active: false },
    { initials: '–', name: soon, level: 'CEFR C1+', tags: [], active: false },
    { initials: '–', name: soon, level: 'CEFR C1+', tags: [], active: false },
  ]
}

export default function Teachers({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const teachers = getTeachers(lang)

  return (
    <section id="teachers" style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left — copy + stats */}
          <div className="lg:sticky lg:top-24">
            <motion.p
              className="ee-label-light mb-5"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            >
              {tx.label}
            </motion.p>

            <motion.h2
              className="font-black whitespace-pre-line mb-6"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', color: '#111111', lineHeight: 1.05 }}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.05, duration: 0.5 }}
            >
              {tx.title}
            </motion.h2>

            <motion.p
              className="ee-body mb-10 max-w-sm"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.1 }}
            >
              {tx.body}
            </motion.p>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.15 }}
            >
              {tx.stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded p-4 text-center"
                  style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                >
                  <div className="text-xl font-black mb-1" style={{ color: '#111111' }}>{s.val}</div>
                  <div className="text-[10px] leading-tight" style={{ color: '#9CA3AF' }}>{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — teacher cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teachers.map((teacher, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="rounded p-5"
                style={{
                  background: teacher.active ? '#fff' : '#F3F4F6',
                  border: teacher.active ? '1px solid #E5E7EB' : '1px solid #E5E7EB',
                  opacity: teacher.active ? 1 : 0.55,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="h-11 w-11 rounded flex items-center justify-center text-[14px] font-black"
                    style={{
                      background: teacher.active ? '#111111' : '#E5E7EB',
                      color: teacher.active ? '#F9F9F9' : '#9CA3AF',
                    }}
                  >
                    {teacher.initials}
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded"
                    style={{
                      background: teacher.active ? 'rgba(196,30,58,0.08)' : '#E5E7EB',
                      color: teacher.active ? '#C41E3A' : '#9CA3AF',
                      border: `1px solid ${teacher.active ? 'rgba(196,30,58,0.15)' : 'transparent'}`,
                    }}
                  >
                    {teacher.active ? tx.active : tx.soon}
                  </span>
                </div>

                <p className="text-[15px] font-bold mb-0.5" style={{ color: teacher.active ? '#111111' : '#9CA3AF' }}>
                  {teacher.name}
                </p>
                <p className="text-[12px] font-semibold mb-3" style={{ color: '#C41E3A' }}>
                  {teacher.level}
                </p>

                {teacher.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
