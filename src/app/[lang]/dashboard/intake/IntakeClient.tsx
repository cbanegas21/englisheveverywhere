'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { saveIntake } from '@/app/actions/intake'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    title: 'Learning Profile',
    subtitle: 'Help your teacher personalize every class to your needs. Takes 60 seconds.',
    step: (n: number, t: number) => `Step ${n} of ${t}`,
    next: 'Next',
    back: 'Back',
    saving: 'Saving…',
    finish: 'Start Scheduling',
    questions: [
      {
        id: 'learning_goal',
        label: 'Why do you want to learn English?',
        placeholder: 'e.g. For work, traveling, moving abroad, passing an exam…',
        type: 'textarea',
      },
      {
        id: 'work_description',
        label: 'What do you do for work?',
        placeholder: 'e.g. Software engineer, nurse, student, entrepreneur…',
        type: 'textarea',
      },
      {
        id: 'learning_style',
        label: 'What is your learning style?',
        type: 'radio',
        options: [
          { value: 'visual',    label: 'Visual',    desc: 'I learn best with images, diagrams, and visual aids' },
          { value: 'auditory',  label: 'Auditory',  desc: 'I learn best by listening and speaking' },
          { value: 'reading',   label: 'Reading',   desc: 'I learn best by reading and writing' },
          { value: 'mixed',     label: 'Mixed',     desc: 'I learn best with a combination of all methods' },
        ],
      },
      {
        id: 'age_range',
        label: 'What is your age range?',
        type: 'radio',
        options: [
          { value: 'under_18', label: 'Under 18' },
          { value: '18_25',    label: '18–25' },
          { value: '26_40',    label: '26–40' },
          { value: '40_plus',  label: '40+' },
        ],
      },
    ],
  },
  es: {
    title: 'Perfil de Aprendizaje',
    subtitle: 'Ayuda a tu maestro a personalizar cada clase. Toma 60 segundos.',
    step: (n: number, t: number) => `Paso ${n} de ${t}`,
    next: 'Siguiente',
    back: 'Atrás',
    saving: 'Guardando…',
    finish: 'Empezar a Agendar',
    questions: [
      {
        id: 'learning_goal',
        label: '¿Por qué quieres aprender inglés?',
        placeholder: 'Ej: Para trabajo, viajar, vivir en otro país, pasar un examen…',
        type: 'textarea',
      },
      {
        id: 'work_description',
        label: '¿A qué te dedicas?',
        placeholder: 'Ej: Ingeniero de software, enfermero, estudiante, emprendedor…',
        type: 'textarea',
      },
      {
        id: 'learning_style',
        label: '¿Cuál es tu estilo de aprendizaje?',
        type: 'radio',
        options: [
          { value: 'visual',   label: 'Visual',   desc: 'Aprendo mejor con imágenes, diagramas y ayudas visuales' },
          { value: 'auditory', label: 'Auditivo', desc: 'Aprendo mejor escuchando y hablando' },
          { value: 'reading',  label: 'Lectura',  desc: 'Aprendo mejor leyendo y escribiendo' },
          { value: 'mixed',    label: 'Mixto',    desc: 'Aprendo mejor combinando todos los métodos' },
        ],
      },
      {
        id: 'age_range',
        label: '¿Cuál es tu rango de edad?',
        type: 'radio',
        options: [
          { value: 'under_18', label: 'Menos de 18' },
          { value: '18_25',    label: '18–25' },
          { value: '26_40',    label: '26–40' },
          { value: '40_plus',  label: '40+' },
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
    setValues(prev => ({ ...prev, [id]: val }))
    setError('')
  }

  function handleNext() {
    if (!values[current.id]?.trim()) {
      setError(lang === 'es' ? 'Por favor responde esta pregunta.' : 'Please answer this question.')
      return
    }
    setError('')
    if (!isLast) {
      setStep(s => s + 1)
      return
    }
    // Submit
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lang', lang)
      Object.entries(values).forEach(([k, v]) => fd.set(k, v))
      const result = await saveIntake(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push(`/${lang}/dashboard/agendar`)
      }
    })
  }

  const progress = ((step) / total) * 100

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-[520px]">

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: '#9CA3AF' }}>
                {tx.step(step + 1, total)}
              </span>
              <span className="text-[12px] font-medium" style={{ color: '#C41E3A' }}>
                {Math.round(((step + 1) / total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: '#C41E3A' }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl p-8"
              style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
            >
              <h2 className="text-[18px] font-bold mb-6" style={{ color: '#111111' }}>
                {current.label}
              </h2>

              {current.type === 'textarea' && (
                <textarea
                  autoFocus
                  value={values[current.id] || ''}
                  onChange={e => setValue(current.id, e.target.value)}
                  placeholder={(current as any).placeholder}
                  rows={4}
                  className="w-full rounded-xl px-4 py-3.5 text-[14px] resize-none outline-none transition-all"
                  style={{
                    border: '1.5px solid #E5E7EB',
                    color: '#111111',
                    background: '#F9F9F9',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNext()
                  }}
                />
              )}

              {current.type === 'radio' && (
                <div className="space-y-2.5">
                  {(current as any).options.map((opt: any) => {
                    const isSelected = values[current.id] === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setValue(current.id, opt.value)}
                        className="w-full text-left rounded-xl px-4 py-3.5 transition-all flex items-center gap-3"
                        style={{
                          border: `1.5px solid ${isSelected ? '#C41E3A' : '#E5E7EB'}`,
                          background: isSelected ? 'rgba(196,30,58,0.04)' : '#fff',
                        }}
                      >
                        <div
                          className="h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            borderColor: isSelected ? '#C41E3A' : '#D1D5DB',
                            background: isSelected ? '#C41E3A' : 'transparent',
                          }}
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className="text-[14px] font-semibold block" style={{ color: '#111111' }}>
                            {opt.label}
                          </span>
                          {opt.desc && (
                            <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{opt.desc}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {error && (
                <p className="mt-3 text-[12px]" style={{ color: '#DC2626' }}>{error}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => { setStep(s => s - 1); setError('') }}
              disabled={step === 0 || isPending}
              className="px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all disabled:opacity-0"
              style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              {tx.back}
            </button>

            <button
              onClick={handleNext}
              disabled={isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-[13px] transition-all disabled:opacity-60"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
              onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
            >
              {isPending ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  {tx.saving}
                </>
              ) : isLast ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tx.finish}
                </>
              ) : (
                <>
                  {tx.next}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
