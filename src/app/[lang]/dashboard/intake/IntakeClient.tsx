'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { saveIntake } from '@/app/actions/intake'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'

const t = {
  en: {
    title: 'Learning profile',
    subtitle: 'Help your teacher make every class about you. Takes about a minute.',
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    next: 'Next',
    back: 'Back',
    saving: 'Saving…',
    finish: 'Start scheduling',
    questions: [
      {
        id: 'learning_goal',
        label: "What's your goal with English?",
        placeholder: 'e.g. Pass the IELTS B2 by December, get a promotion, move to Canada…',
        type: 'textarea',
      },
      {
        id: 'work_description',
        label: 'What do you do day to day?',
        placeholder: 'e.g. Software engineer, nurse, student, entrepreneur…',
        type: 'textarea',
      },
      {
        id: 'learning_style',
        label: 'How do you learn best?',
        type: 'radio',
        options: [
          { value: 'visual', label: 'Visual', desc: 'Images, diagrams, things I can see.' },
          { value: 'auditory', label: 'Listening', desc: 'Hearing and speaking it out loud.' },
          { value: 'reading', label: 'Reading', desc: 'Reading and writing it down.' },
          { value: 'mixed', label: 'A mix', desc: 'A bit of everything.' },
        ],
      },
      {
        id: 'age_range',
        label: "What's your age range?",
        type: 'radio',
        options: [
          { value: 'under_18', label: 'Under 18' },
          { value: '18_25', label: '18–25' },
          { value: '26_40', label: '26–40' },
          { value: '40_plus', label: '40+' },
        ],
      },
    ],
  },
  es: {
    title: 'Perfil de aprendizaje',
    subtitle: 'Ayuda a tu maestro a hacer cada clase sobre ti. Toma alrededor de un minuto.',
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    next: 'Siguiente',
    back: 'Atrás',
    saving: 'Guardando…',
    finish: 'Empezar a agendar',
    questions: [
      {
        id: 'learning_goal',
        label: '¿Cuál es tu meta con el inglés?',
        placeholder: 'Ej: Pasar el IELTS B2 en diciembre, conseguir un ascenso, emigrar a Canadá…',
        type: 'textarea',
      },
      {
        id: 'work_description',
        label: '¿A qué te dedicas en tu día a día?',
        placeholder: 'Ej: Ingeniero de software, enfermero, estudiante, emprendedor…',
        type: 'textarea',
      },
      {
        id: 'learning_style',
        label: '¿Cómo aprendes mejor?',
        type: 'radio',
        options: [
          { value: 'visual', label: 'Visual', desc: 'Imágenes, diagramas, cosas que puedo ver.' },
          { value: 'auditory', label: 'Escuchando', desc: 'Oyéndolo y hablándolo en voz alta.' },
          { value: 'reading', label: 'Leyendo', desc: 'Leyéndolo y escribiéndolo.' },
          { value: 'mixed', label: 'Una mezcla', desc: 'Un poco de todo.' },
        ],
      },
      {
        id: 'age_range',
        label: '¿Cuál es tu rango de edad?',
        type: 'radio',
        options: [
          { value: 'under_18', label: 'Menos de 18' },
          { value: '18_25', label: '18–25' },
          { value: '26_40', label: '26–40' },
          { value: '40_plus', label: '40+' },
        ],
      },
    ],
  },
}

interface Props { lang: Locale }

export default function IntakeClient({ lang }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const questions = tx.questions
  const current = questions[step]
  const total = questions.length
  const isLast = step === total - 1

  function setValue(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }))
    setError('')
  }

  function handleNext() {
    if (!values[current.id]?.trim()) {
      setError(lang === 'es' ? 'Por favor responde esta pregunta.' : 'Please answer this question.')
      return
    }
    setError('')
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lang', lang)
      Object.entries(values).forEach(([k, v]) => fd.set(k, v))
      const result = await saveIntake(fd)
      if (result?.error) setError(result.error)
      else router.push(`/${lang}/dashboard/agendar`)
    })
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div style={{ display: 'flex', justifyContent: 'center', padding: 'clamp(28px, 5vw, 56px) clamp(16px, 4vw, 36px)' }}>
        <div style={{ width: '100%', maxWidth: 540 }}>
          {/* Progress — mono label + hairline bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="ek-microlabel">{tx.step(step + 1, total)}</span>
              <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ek-red)' }}>
                {Math.round(((step + 1) / total) * 100)}%
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--ek-border)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--ek-red)' }}
                initial={{ width: 0 }}
                animate={{ width: `${((step + 1) / total) * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
                padding: 'clamp(22px, 4vw, 32px)',
              }}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ek-text)' }}>
                {current.label}
              </h2>

              {current.type === 'textarea' && (
                <textarea
                  autoFocus
                  className="lk-intake-input"
                  value={values[current.id] || ''}
                  onChange={(e) => setValue(current.id, e.target.value)}
                  placeholder={(current as { placeholder?: string }).placeholder}
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNext()
                  }}
                />
              )}

              {current.type === 'radio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(current as { options: { value: string; label: string; desc?: string }[] }).options.map((opt) => {
                    const sel = values[current.id] === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setValue(current.id, opt.value)}
                        className="lk-intake-opt"
                        style={{
                          borderColor: sel ? 'var(--ek-red)' : 'var(--ek-border)',
                          background: sel ? 'var(--ek-red-tint)' : 'var(--ek-card)',
                        }}
                      >
                        <span
                          className="lk-intake-radio"
                          style={{
                            borderColor: sel ? 'var(--ek-red)' : 'var(--ek-border-mid)',
                            background: sel ? 'var(--ek-red)' : 'transparent',
                          }}
                        >
                          {sel && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>
                            {opt.label}
                          </span>
                          {opt.desc && (
                            <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{opt.desc}</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ek-red)' }}>{error}</p>}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
            <button
              onClick={() => { setStep((s) => s - 1); setError('') }}
              disabled={step === 0 || isPending}
              className="ek-btn ek-btn-ghost ek-btn-square"
              style={{ opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto', fontSize: 13 }}
            >
              {tx.back}
            </button>
            <button
              onClick={handleNext}
              disabled={isPending}
              className="ek-btn ek-btn-red ek-btn-square"
              style={{ fontSize: 13, opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? tx.saving : isLast ? tx.finish : tx.next}
              {!isPending && <span style={{ fontSize: 15 }}>→</span>}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .lk-intake-input {
          width: 100%;
          border-radius: var(--ek-radius-md);
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          outline: none;
          border: 1px solid var(--ek-border);
          background: var(--ek-paper-warm);
          color: var(--ek-text);
          font-family: var(--ek-font-sans);
          transition: border-color 0.18s ease;
        }
        .lk-intake-input:focus { border-color: var(--ek-red); }
        .lk-intake-input::placeholder { color: var(--ek-text-faint); }
        .lk-intake-opt {
          width: 100%;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--ek-border);
          border-radius: var(--ek-radius-md);
          padding: 14px 16px;
          cursor: pointer;
          background: var(--ek-card);
          transition: border-color 0.15s ease, background 0.15s ease;
          font-family: var(--ek-font-sans);
        }
        .lk-intake-opt:hover { border-color: var(--ek-border-mid); }
        .lk-intake-radio {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
      `}</style>
    </div>
  )
}
