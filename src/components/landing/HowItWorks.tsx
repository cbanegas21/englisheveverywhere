'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    steps: [
      { num: '01', title: 'Choose your pack',          desc: 'Pick 8, 12, 16, or 20 classes. One payment. No auto-renewal, ever. Your classes never expire.' },
      { num: '02', title: 'We assign your teacher',     desc: 'Our team personally matches you with a near-native Honduran teacher based on your level, goals, and schedule.' },
      { num: '03', title: 'Schedule your sessions',     desc: 'Pick your weekly slots. Consistency is what creates real progress — same time, every week.' },
      { num: '04', title: 'AI-powered class summaries', desc: 'After every class: vocabulary recap, grammar notes, personalized next steps. Automatically in your inbox.' },
    ],
    sectionLabel: 'Simple process',
    title: 'Four steps.\nThat\'s it.',
    sub: 'No placement test. No marketplace browsing. No strangers. We handle the matching — you just show up and learn.',
  },
  es: {
    steps: [
      { num: '01', title: 'Elige tu pack',               desc: 'Escoge 8, 12, 16 o 20 clases. Un pago. Sin renovación automática. Tus clases nunca vencen.' },
      { num: '02', title: 'Te asignamos tu maestro',     desc: 'Nuestro equipo te empareja personalmente con un maestro near-native de Honduras según tu nivel, objetivos y horario.' },
      { num: '03', title: 'Agenda tus sesiones',          desc: 'Elige tus horarios semanales. La constancia es lo que crea progreso real — misma hora, cada semana.' },
      { num: '04', title: 'Resúmenes de clase con IA',   desc: 'Después de cada clase: vocabulario, notas de gramática, próximos pasos personalizados. Automáticamente en tu correo.' },
    ],
    sectionLabel: 'Proceso simple',
    title: 'Cuatro pasos.\nNada más.',
    sub: 'Sin placement test. Sin marketplace. Sin extraños. Nosotros hacemos el emparejamiento — tú solo apareces y aprendes.',
  },
}

export default function HowItWorks({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section id="how-it-works" style={{ background: '#111111' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          <div>
            <motion.p
              className="ee-label mb-4"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            >
              {tx.sectionLabel}
            </motion.p>
            <motion.h2
              className="font-black whitespace-pre-line"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#F9F9F9', lineHeight: 1.05 }}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.05, duration: 0.5 }}
            >
              {tx.title}
            </motion.h2>
          </div>
          <div className="flex items-end">
            <motion.p
              className="ee-body-dark max-w-md"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.1 }}
            >
              {tx.sub}
            </motion.p>
          </div>
        </div>

        {/* Steps — 2×2 grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-px"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}
        >
          {tx.steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="p-8 group"
              style={{ background: '#111111' }}
            >
              {/* Step number — large ghost */}
              <div className="relative mb-6">
                <span
                  className="text-[11px] font-black tracking-[0.15em] block"
                  style={{ color: '#C41E3A' }}
                >
                  {step.num}
                </span>
              </div>
              <h3
                className="text-[17px] font-bold mb-3"
                style={{ color: '#F9F9F9' }}
              >
                {step.title}
              </h3>
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: 'rgba(249,249,249,0.5)' }}
              >
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
