'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    label: 'FAQ',
    headline: 'Common questions.',
    questions: [
      { q: 'What level do I need to start?', a: 'None. We accept complete beginners (A0) through advanced speakers (C2). We assess your level before your first class.' },
      { q: 'How do the classes work?', a: 'All classes happen inside the EnglishEverywhere platform via live video. No Zoom, no Google Meet, no extra installs.' },
      { q: 'Who chooses my teacher?', a: 'We do. Our team personally matches you with the best teacher for your level and goals. You\'ll meet your teacher before your first paid class.' },
      { q: 'What is your cancellation policy?', a: 'Cancel or reschedule with at least 24 hours notice at no charge. Classes without advance notice are forfeited.' },
      { q: 'Do my classes expire?', a: 'No. Once you buy a pack, those classes are yours until you use them. No pressure, no countdown.' },
      { q: 'What\'s included in every pack?', a: 'Live 1-on-1 video sessions, near-native teacher, AI post-class summaries, CEFR level tracking, and direct support.' },
      { q: 'Is there a money-back guarantee?', a: 'Yes. If you\'re not satisfied after your first paid class, we refund you in full. No questions.' },
    ],
  },
  es: {
    label: 'Preguntas frecuentes',
    headline: 'Preguntas comunes.',
    questions: [
      { q: '¿Qué nivel necesito para empezar?', a: 'Ninguno. Aceptamos desde principiantes (A0) hasta avanzados (C2). Evaluamos tu nivel antes de tu primera clase.' },
      { q: '¿Cómo funcionan las clases?', a: 'Todas las clases se realizan dentro de la plataforma EnglishEverywhere por video en vivo. Sin Zoom, sin Google Meet, sin instalaciones extra.' },
      { q: '¿Quién elige mi maestro?', a: 'Nosotros. Nuestro equipo te empareja personalmente con el mejor maestro para tu nivel y objetivos. Lo conocerás antes de tu primera clase pagada.' },
      { q: '¿Cuál es la política de cancelación?', a: 'Cancela o reprograma con al menos 24 horas de aviso sin costo. Las clases sin aviso previo se pierden.' },
      { q: '¿Mis clases vencen?', a: 'No. Una vez que compras un pack, esas clases son tuyas hasta que las uses. Sin presión, sin cuenta regresiva.' },
      { q: '¿Qué incluye cada pack?', a: 'Sesiones 1-a-1 en vivo por video, maestro near-native, resúmenes con IA post-clase, seguimiento de nivel CEFR y soporte directo.' },
      { q: '¿Hay garantía de devolución?', a: 'Sí. Si no estás satisfecho después de tu primera clase pagada, te devolvemos el dinero completo. Sin preguntas.' },
    ],
  },
}

export default function FAQ({ lang }: { lang: Locale }) {
  const copy = t[lang]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB' }}>
      <div className="max-w-3xl mx-auto px-6 py-24">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <p className="ee-label-light mb-4">{copy.label}</p>
          <h2
            className="font-black"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#111111', lineHeight: 1.1 }}
          >
            {copy.headline}
          </h2>
        </motion.div>

        <div className="space-y-2">
          {copy.questions.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="rounded overflow-hidden"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span
                  className="font-bold text-[14px] pr-4"
                  style={{ color: open === i ? '#C41E3A' : '#111111' }}
                >
                  {item.q}
                </span>
                <span
                  className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center transition-colors"
                  style={{
                    background: open === i ? 'rgba(196,30,58,0.08)' : '#F3F4F6',
                    color: open === i ? '#C41E3A' : '#9CA3AF',
                    border: `1px solid ${open === i ? 'rgba(196,30,58,0.15)' : 'transparent'}`,
                  }}
                >
                  {open === i
                    ? <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  }
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-6 pb-5 text-[13px] leading-relaxed pt-1"
                      style={{ borderTop: '1px solid #E5E7EB', color: '#4B5563' }}
                    >
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
