'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const DATA = {
  en: [
    { quote: 'I tried Duolingo and YouTube for 3 years. Two months with English Everywhere and I had my first real conversation in English at work.', name: 'Andrea M.', role: 'HR Manager', city: 'Tegucigalpa' },
    { quote: 'My teacher is Honduran. She knows exactly why I struggle and how to explain things so they click. No other platform gave me that.', name: 'Roberto C.', role: 'Engineer', city: 'San Pedro Sula' },
    { quote: 'No subscription trap. No monthly fee I forget to cancel. Just classes when I need them. That alone was why I chose this over Cambly.', name: 'David H.', role: 'Remote worker', city: 'Choloma' },
    { quote: 'The AI recap after each class is something else. I have a record of every word I learned, every grammar point we covered. I actually study.', name: 'María F.', role: 'Entrepreneur', city: 'La Ceiba' },
  ],
  es: [
    { quote: 'Intenté Duolingo y YouTube por 3 años. Dos meses con English Everywhere y tuve mi primera conversación real en inglés en el trabajo.', name: 'Andrea M.', role: 'Gerente de RRHH', city: 'Tegucigalpa' },
    { quote: 'Mi maestra es hondureña. Sabe exactamente por qué me cuesta y cómo explicarme las cosas para que me hagan clic. Ninguna otra plataforma me dio eso.', name: 'Roberto C.', role: 'Ingeniero', city: 'San Pedro Sula' },
    { quote: 'Sin trampa de suscripción. Sin mensualidad que olvido cancelar. Solo clases cuando las necesito. Eso solo fue la razón por la que elegí esto sobre Cambly.', name: 'David H.', role: 'Trabajador remoto', city: 'Choloma' },
    { quote: 'El resumen con IA después de cada clase es increíble. Tengo un registro de cada palabra que aprendí, cada punto de gramática. Realmente estudio.', name: 'María F.', role: 'Emprendedora', city: 'La Ceiba' },
  ],
}

const t = {
  en: { label: 'What students say', title: 'Real people.\nReal results.' },
  es: { label: 'Lo que dicen los estudiantes', title: 'Personas reales.\nResultados reales.' },
}

export default function Testimonials({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const items = DATA[lang]
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive(c => (c + 1) % items.length), 6000)
    return () => clearInterval(id)
  }, [items.length])

  const item = items[active]

  return (
    <section style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left — header + nav */}
          <div>
            <p className="ee-label mb-5">{tx.label}</p>
            <h2
              className="font-black whitespace-pre-line mb-10"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#F9F9F9', lineHeight: 1.1 }}
            >
              {tx.title}
            </h2>

            {/* Dots */}
            <div className="flex gap-2 mb-6">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="rounded transition-all"
                  style={{
                    height: 4,
                    width: i === active ? 28 : 4,
                    background: i === active ? '#C41E3A' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-3">
              <button
                onClick={() => setActive(c => (c - 1 + items.length) % items.length)}
                className="h-10 w-10 rounded flex items-center justify-center text-lg transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(249,249,249,0.6)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              >
                ←
              </button>
              <button
                onClick={() => setActive(c => (c + 1) % items.length)}
                className="h-10 w-10 rounded flex items-center justify-center text-lg transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(249,249,249,0.6)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              >
                →
              </button>
            </div>
          </div>

          {/* Right — quote */}
          <div
            className="rounded p-8"
            style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-6xl font-black leading-none mb-4" style={{ color: '#C41E3A' }}>&ldquo;</p>

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <p
                  className="text-[17px] leading-relaxed mb-6"
                  style={{ color: 'rgba(249,249,249,0.8)', fontStyle: 'italic' }}
                >
                  {item.quote}
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
                  <p className="text-[14px] font-bold" style={{ color: '#F9F9F9' }}>{item.name}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'rgba(249,249,249,0.4)' }}>
                    {item.role} · {item.city}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  )
}
