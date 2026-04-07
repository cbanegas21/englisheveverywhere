'use client'

import { useState, useTransition, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, ChevronRight, ChevronLeft, Calendar,
  Clock, X, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { saveSurveyAnswers, bookPlacementCall } from '@/app/actions/placement'
import type { Locale } from '@/lib/i18n/translations'

// ─── Question definitions ─────────────────────────────────────────────────

interface Option { id: string; en: string; es: string }
interface Question {
  id: string
  type: 'single' | 'multi' | 'text'
  en: string
  es: string
  optional?: boolean
  options?: Option[]
}

const QUESTIONS: Question[] = [
  {
    id: 'goals', type: 'multi',
    en: 'Why do you want to learn English?',
    es: '¿Por qué quieres aprender inglés?',
    options: [
      { id: 'work',     en: 'Work',           es: 'Para el trabajo' },
      { id: 'travel',   en: 'Travel',          es: 'Para viajar' },
      { id: 'studies',  en: 'Studies',         es: 'Para mis estudios' },
      { id: 'growth',   en: 'Personal growth', es: 'Crecimiento personal' },
      { id: 'emigrate', en: 'Move abroad',     es: 'Quiero emigrar' },
      { id: 'other',    en: 'Other',           es: 'Otro' },
    ],
  },
  {
    id: 'level', type: 'single',
    en: 'How much English do you know?',
    es: '¿Cuánto inglés sabes?',
    options: [
      { id: 'zero',         en: "Zero — I don't know any English",                 es: 'Cero — no sé nada' },
      { id: 'beginner',     en: 'Beginner — I know some words',                    es: 'Principiante — sé algunas palabras' },
      { id: 'elementary',   en: 'Elementary — I can write simple sentences',       es: 'Elemental — puedo escribir oraciones simples' },
      { id: 'intermediate', en: 'Intermediate — I can hold a basic conversation',  es: 'Intermedio — puedo mantener una conversación básica' },
      { id: 'advanced',     en: "Advanced — I'm fluent but want to improve",       es: 'Avanzado — soy fluido pero quiero mejorar' },
    ],
  },
  {
    id: 'speaking', type: 'single',
    en: 'Can you speak English right now?',
    es: '¿Puedes hablar inglés ahora mismo?',
    options: [
      { id: 'yes',        en: 'Yes, confidently',  es: 'Sí, con confianza' },
      { id: 'a_little',   en: 'A little',           es: 'Un poco' },
      { id: 'not_really', en: 'Not really',         es: 'No mucho' },
      { id: 'not_at_all', en: 'Not at all',         es: 'Para nada' },
    ],
  },
  {
    id: 'frequency', type: 'single',
    en: 'How often do you currently study or practice English?',
    es: '¿Qué tan seguido estudias o practicas inglés?',
    options: [
      { id: 'daily',   en: 'Daily',                es: 'Todos los días' },
      { id: 'weekly',  en: 'A few times a week',   es: 'Algunas veces a la semana' },
      { id: 'rarely',  en: 'Rarely',               es: 'Rara vez' },
      { id: 'never',   en: 'Never',                es: 'Nunca' },
    ],
  },
  {
    id: 'style', type: 'single',
    en: 'How do you learn best?',
    es: '¿Cómo aprendes mejor?',
    options: [
      { id: 'listening', en: 'Listening',  es: 'Escuchando' },
      { id: 'reading',   en: 'Reading',    es: 'Leyendo' },
      { id: 'speaking',  en: 'Speaking',   es: 'Hablando' },
      { id: 'writing',   en: 'Writing',    es: 'Escribiendo' },
      { id: 'mixed',     en: 'Mixed',      es: 'Combinado' },
    ],
  },
  {
    id: 'pace', type: 'single',
    en: 'How fast do you want to progress?',
    es: '¿Qué tan rápido quieres avanzar?',
    options: [
      { id: 'relaxed',   en: 'Relaxed — 1–2 classes per week',      es: 'Tranquilo — 1-2 clases por semana' },
      { id: 'steady',    en: 'Steady — 3 classes per week',         es: 'Constante — 3 clases por semana' },
      { id: 'intensive', en: 'Intensive — every day if possible',   es: 'Intensivo — todos los días si es posible' },
    ],
  },
  {
    id: 'notes', type: 'text', optional: true,
    en: 'Anything else you want your teacher to know before your first class?',
    es: '¿Hay algo más que quieras que tu maestra sepa antes de tu primera clase?',
  },
]

// ─── Slot generation (Honduras CST = UTC-6) ──────────────────────────────

interface BusinessDay {
  isoDate: string
  labelEs: string
  labelEn: string
  shortLabel: string
  slots: string[] // ISO UTC strings
}

function generateBusinessDays(count = 7): BusinessDay[] {
  const days: BusinessDay[] = []
  const nowMs = Date.now()
  const minMs = nowMs + 24 * 60 * 60 * 1000 // 24h notice

  let offset = 1
  while (days.length < count && offset <= 30) {
    // Get date in Honduras timezone (CST = UTC-6)
    const targetMs = nowMs + offset * 86400000
    const hnMs = targetMs - 6 * 3600000 // UTC-6: subtract 6h to get HN time
    const hn = new Date(hnMs)

    const dow = hn.getUTCDay()
    if (dow === 0 || dow === 6) { offset++; continue } // skip weekends

    const yr = hn.getUTCFullYear()
    const mo = hn.getUTCMonth()
    const dy = hn.getUTCDate()

    const slots: string[] = []
    for (let h = 6; h <= 20; h++) {
      // h AM HN = (h + 6) UTC
      const slotMs = Date.UTC(yr, mo, dy, h + 6, 0, 0)
      if (slotMs > minMs) slots.push(new Date(slotMs).toISOString())
    }

    if (slots.length > 0) {
      const base = new Date(Date.UTC(yr, mo, dy))
      days.push({
        isoDate: base.toISOString().slice(0, 10),
        labelEs: base.toLocaleDateString('es-HN', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
        labelEn: base.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
        shortLabel: base.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        slots,
      })
    }
    offset++
  }

  return days
}

function fmtSlot(isoUtc: string): string {
  // Convert UTC → Honduras (UTC-6) for display
  const d = new Date(new Date(isoUtc).getTime() - 6 * 3600000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtBookingDate(isoUtc: string, lang: Locale): string {
  return new Date(isoUtc).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })
}

// ─── Framer Motion variants ───────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: 'easeOut' as const } },
  exit: (dir: number) => ({ x: dir * -50, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' as const } }),
}

// ─── UI translations ──────────────────────────────────────────────────────

const ui = {
  en: {
    step: (n: number, t: number) => `Question ${n} of ${t}`,
    multi: 'Select all that apply',
    back: 'Back',
    next: 'Next',
    finish: 'Done',
    skip: 'Skip',
    transTitle: 'Perfect!',
    transSub: "Now let's schedule your free 60-minute evaluation call.",
    transBody: "Not sure what your level is? We'll figure it out together — no pressure, no judgment.",
    scheduleBtn: 'Schedule my call',
    scheduleTitle: 'Schedule your free evaluation call',
    scheduleSub: 'Pick a day and time. All times shown in Honduras time (CST).',
    pickTime: 'Pick a time',
    noSlots: 'No available slots for this day.',
    confirmTitle: 'Confirm your call',
    confirmDate: 'Date & time',
    confirmDuration: 'Duration',
    confirmDurationVal: '60 minutes · Free',
    confirmNote: 'We will contact you through the platform for the call.',
    confirmBtn: 'Confirm',
    confirming: 'Scheduling…',
    cancelBtn: 'Cancel',
    confirmedTitle: 'You\'re all set!',
    confirmedSub: 'Your evaluation call is scheduled for:',
    confirmedNote: 'You\'ll receive a confirmation email shortly. We\'ll reach out through the platform at call time.',
    backDash: 'Back to dashboard',
    alreadyTitle: 'Call already scheduled',
    alreadySub: 'Your evaluation call is scheduled for:',
    placeholder: 'Optional — max 200 characters',
    timezone: 'All times in Honduras time (CST, UTC-6)',
  },
  es: {
    step: (n: number, t: number) => `Pregunta ${n} de ${t}`,
    multi: 'Selecciona todas las que apliquen',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Listo',
    skip: 'Omitir',
    transTitle: '¡Perfecto!',
    transSub: 'Ahora agenda tu llamada de diagnóstico gratuita de 60 minutos.',
    transBody: '¿No sabes cuál es tu nivel? Lo descubrimos juntos — sin presión, sin juicios.',
    scheduleBtn: 'Agendar mi llamada',
    scheduleTitle: 'Agenda tu llamada de diagnóstico gratuita',
    scheduleSub: 'Elige un día y hora. Horarios en hora de Honduras (CST).',
    pickTime: 'Elige un horario',
    noSlots: 'Sin horarios disponibles para este día.',
    confirmTitle: 'Confirmar tu llamada',
    confirmDate: 'Fecha y hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '60 minutos · Gratis',
    confirmNote: 'Nos comunicaremos contigo a través de la plataforma para la llamada.',
    confirmBtn: 'Confirmar',
    confirming: 'Agendando…',
    cancelBtn: 'Cancelar',
    confirmedTitle: '¡Todo listo!',
    confirmedSub: 'Tu llamada de diagnóstico está agendada para:',
    confirmedNote: 'Recibirás un correo de confirmación en breve. Nos comunicaremos contigo en el horario acordado.',
    backDash: 'Volver al dashboard',
    alreadyTitle: 'Llamada ya agendada',
    alreadySub: 'Tu llamada de diagnóstico está programada para:',
    placeholder: 'Opcional — máx. 200 caracteres',
    timezone: 'Horarios en hora de Honduras (CST, UTC-6)',
  },
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  lang: Locale
  studentId: string
  existingAnswers: Record<string, unknown> | null
  existingBooking: { id: string; scheduledAt: string; status: string } | null
}

type Answers = Record<string, string | string[]>
type Stage = 'survey' | 'transition' | 'schedule' | 'confirmed'

// ─── Component ────────────────────────────────────────────────────────────

export default function PlacementClient({
  lang,
  existingAnswers,
  existingBooking,
}: Props) {
  const tx = ui[lang]

  const initialStage: Stage = existingBooking
    ? 'confirmed'
    : existingAnswers
    ? 'schedule'
    : 'survey'

  const [stage, setStage] = useState<Stage>(initialStage)
  const [qIndex, setQIndex] = useState(0)
  const [dir, setDir] = useState(1) // 1=forward, -1=back
  const [answers, setAnswers] = useState<Answers>(
    (existingAnswers as Answers) || {}
  )
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(
    existingBooking?.scheduledAt || null
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const businessDays = useMemo(() => generateBusinessDays(7), [])
  const totalQ = QUESTIONS.length
  const currentQ = QUESTIONS[qIndex]

  // ── Answer helpers ─────────────────────────────────────────────

  function toggleMulti(qId: string, optId: string) {
    setAnswers(prev => {
      const cur = (prev[qId] as string[] | undefined) || []
      const next = cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId]
      return { ...prev, [qId]: next }
    })
  }

  function setSingle(qId: string, optId: string) {
    setAnswers(prev => ({ ...prev, [qId]: optId }))
  }

  function setText(qId: string, val: string) {
    setAnswers(prev => ({ ...prev, [qId]: val }))
  }

  function canAdvance(): boolean {
    if (currentQ.optional) return true
    const val = answers[currentQ.id]
    if (currentQ.type === 'multi') return Array.isArray(val) && val.length > 0
    if (currentQ.type === 'text') return true // optional
    return typeof val === 'string' && val.length > 0
  }

  // ── Navigation ────────────────────────────────────────────────

  function goNext() {
    if (!canAdvance()) return
    if (qIndex < totalQ - 1) {
      setDir(1)
      setQIndex(q => q + 1)
    } else {
      // Last question — save and transition
      startTransition(async () => {
        const result = await saveSurveyAnswers(answers, lang)
        if (result?.error) {
          setError(result.error)
        } else {
          setStage('transition')
        }
      })
    }
  }

  function goBack() {
    if (qIndex === 0) return
    setDir(-1)
    setQIndex(q => q - 1)
  }

  // ── Booking ───────────────────────────────────────────────────

  function handleConfirmBooking() {
    if (!selectedSlot) return
    setError('')
    startTransition(async () => {
      const result = await bookPlacementCall(selectedSlot, lang)
      if (result?.error) {
        setError(result.error)
      } else {
        setConfirmedAt(selectedSlot)
        setShowModal(false)
        setStage('confirmed')
      }
    })
  }

  // ── Confirmed / Already booked ────────────────────────────────

  if (stage === 'confirmed') {
    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>
            {existingBooking && stage === 'confirmed' && confirmedAt === existingBooking.scheduledAt
              ? tx.alreadyTitle
              : tx.confirmedTitle}
          </h1>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-[420px] rounded-2xl overflow-hidden text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
          >
            <div className="py-10 px-6" style={{ background: 'linear-gradient(135deg, #C41E3A, #8B1529)' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[22px] font-black text-white mb-2">
                {existingBooking && confirmedAt === existingBooking.scheduledAt
                  ? tx.alreadyTitle
                  : tx.confirmedTitle}
              </h2>
              <p className="text-[14px] text-white/75">
                {existingBooking && confirmedAt === existingBooking.scheduledAt
                  ? tx.alreadySub
                  : tx.confirmedSub}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {confirmedAt && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4" style={{ color: '#C41E3A' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                      {lang === 'es' ? 'Hora de Honduras (CST)' : 'Honduras time (CST)'}
                    </span>
                  </div>
                  <p className="text-[15px] font-bold" style={{ color: '#111111' }}>
                    {fmtBookingDate(confirmedAt, lang)}
                  </p>
                </div>
              )}
              <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
                {tx.confirmedNote}
              </p>
              <Link
                href={`/${lang}/dashboard`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded font-bold text-[13px] transition-all"
                style={{ background: '#C41E3A', color: '#fff' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
              >
                {tx.backDash}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Transition screen ─────────────────────────────────────────

  if (stage === 'transition') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-4" style={{ background: '#F9F9F9' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center max-w-md"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(196,30,58,0.08)' }}
          >
            <span className="text-[40px]">🎉</span>
          </div>
          <h2 className="text-[32px] font-black mb-3" style={{ color: '#111111' }}>
            {tx.transTitle}
          </h2>
          <p className="text-[18px] font-semibold mb-2" style={{ color: '#111111' }}>
            {tx.transSub}
          </p>
          <p className="text-[15px] leading-relaxed mb-8" style={{ color: '#4B5563' }}>
            {tx.transBody}
          </p>
          <button
            onClick={() => setStage('schedule')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded font-bold text-[15px] transition-all"
            style={{ background: '#C41E3A', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
          >
            <Calendar className="h-4 w-4" />
            {tx.scheduleBtn}
          </button>
        </motion.div>
      </div>
    )
  }

  // ── Schedule screen ───────────────────────────────────────────

  if (stage === 'schedule') {
    const selectedDay = businessDays[selectedDayIdx]

    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.scheduleTitle}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.scheduleSub}</p>
        </div>

        <div className="px-6 py-6 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Day picker */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div className="px-4 py-3" style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  {lang === 'es' ? 'Selecciona el día' : 'Select a day'}
                </p>
              </div>
              {businessDays.map((day, i) => (
                <button
                  key={day.isoDate}
                  onClick={() => { setSelectedDayIdx(i); setSelectedSlot(null) }}
                  className="w-full px-4 py-3.5 text-left transition-all"
                  style={{
                    background: i === selectedDayIdx ? 'rgba(196,30,58,0.06)' : '#fff',
                    borderBottom: '1px solid #F3F4F6',
                    borderLeft: i === selectedDayIdx ? '3px solid #C41E3A' : '3px solid transparent',
                  }}
                >
                  <p className="text-[13px] font-semibold capitalize" style={{ color: i === selectedDayIdx ? '#C41E3A' : '#111111' }}>
                    {lang === 'es' ? day.labelEs.split(',')[0] : day.labelEn.split(',')[0]}
                  </p>
                  <p className="text-[11px] capitalize" style={{ color: '#9CA3AF' }}>
                    {lang === 'es' ? day.labelEs.split(',').slice(1).join(',').trim() : day.labelEn.split(',').slice(1).join(',').trim()}
                  </p>
                </button>
              ))}
            </div>

            {/* Time slots */}
            <div className="md:col-span-2 rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="px-4 py-3" style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  {tx.pickTime} · {tx.timezone}
                </p>
              </div>

              {selectedDay?.slots.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noSlots}</p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-4 gap-2">
                  {selectedDay?.slots.map(slot => {
                    const isSelected = selectedSlot === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setShowModal(true)
                          setError('')
                        }}
                        className="py-2.5 px-2 rounded text-[13px] font-bold transition-all"
                        style={
                          isSelected
                            ? { background: '#C41E3A', color: '#fff' }
                            : { background: '#F9F9F9', color: '#111111', border: '1px solid #E5E7EB' }
                        }
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#C41E3A' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#E5E7EB' }}
                      >
                        {fmtSlot(slot)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirm modal */}
        <AnimatePresence>
          {showModal && selectedSlot && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => !isPending && setShowModal(false)}
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(2px)' }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ background: '#fff' }}
              >
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: '#C41E3A' }} />
                    <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                  </div>
                  <button
                    onClick={() => !isPending && setShowModal(false)}
                    disabled={isPending}
                    className="transition-colors disabled:opacity-40"
                    style={{ color: '#9CA3AF' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-3">
                  {[
                    [tx.confirmDate, fmtBookingDate(selectedSlot, lang)],
                    [tx.confirmDuration, tx.confirmDurationVal],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 text-[13px]">
                      <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{label}</span>
                      <span className="font-semibold text-right" style={{ color: '#111111' }}>{value}</span>
                    </div>
                  ))}
                  <p className="text-[12px] leading-relaxed pt-1" style={{ color: '#9CA3AF' }}>
                    {tx.confirmNote}
                  </p>
                </div>

                {error && (
                  <div className="mx-6 mb-3 rounded p-3 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={() => !isPending && setShowModal(false)}
                    disabled={isPending}
                    className="flex-1 py-3 rounded font-medium text-[13px] transition-all"
                    style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                  >
                    {tx.cancelBtn}
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-bold text-[13px] transition-all disabled:opacity-60"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                    onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
                  >
                    {isPending ? (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        {tx.confirming}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {tx.confirmBtn}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Survey screen ─────────────────────────────────────────────

  const progress = ((qIndex) / totalQ) * 100

  return (
    <div className="min-h-full flex flex-col" style={{ background: '#F9F9F9' }}>
      {/* Header with progress */}
      <div className="px-8 py-5" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-semibold" style={{ color: '#9CA3AF' }}>
            {tx.step(qIndex + 1, totalQ)}
          </p>
          <p className="text-[12px] font-black" style={{ color: '#C41E3A' }}>
            {Math.round(progress + 100 / totalQ)}%
          </p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: '#C41E3A' }}
            animate={{ width: `${progress + 100 / totalQ}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={qIndex}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* Question */}
              <h2
                className="text-[22px] font-black mb-2 leading-snug"
                style={{ color: '#111111' }}
              >
                {lang === 'es' ? currentQ.es : currentQ.en}
              </h2>
              {currentQ.type === 'multi' && (
                <p className="text-[13px] mb-6" style={{ color: '#9CA3AF' }}>{tx.multi}</p>
              )}
              {(currentQ.type === 'single' || currentQ.type === 'multi') && (
                <p className="text-[13px] mb-6" style={{ color: '#9CA3AF' }}>
                  {currentQ.type === 'multi' ? '' : ''}
                </p>
              )}

              {/* Single / multi select options */}
              {currentQ.options && (
                <div className="space-y-2.5">
                  {currentQ.options.map(opt => {
                    const val = answers[currentQ.id]
                    const isActive = currentQ.type === 'multi'
                      ? (Array.isArray(val) && val.includes(opt.id))
                      : val === opt.id

                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (currentQ.type === 'multi') toggleMulti(currentQ.id, opt.id)
                          else setSingle(currentQ.id, opt.id)
                        }}
                        className="w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(196,30,58,0.06)' : '#fff',
                          border: `1.5px solid ${isActive ? '#C41E3A' : '#E5E7EB'}`,
                          boxShadow: isActive ? '0 0 0 2px rgba(196,30,58,0.08)' : 'none',
                        }}
                      >
                        <div
                          className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all"
                          style={{
                            background: isActive ? '#C41E3A' : 'transparent',
                            border: `1.5px solid ${isActive ? '#C41E3A' : '#D1D5DB'}`,
                            borderRadius: currentQ.type === 'multi' ? '4px' : '50%',
                          }}
                        >
                          {isActive && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              {currentQ.type === 'multi'
                                ? <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                : <circle cx="5" cy="5" r="2.5" fill="#fff"/>
                              }
                            </svg>
                          )}
                        </div>
                        <span className="text-[14px] font-medium" style={{ color: '#111111' }}>
                          {lang === 'es' ? opt.es : opt.en}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Text area for Q7 */}
              {currentQ.type === 'text' && (
                <div>
                  <textarea
                    value={(answers[currentQ.id] as string) || ''}
                    onChange={e => setText(currentQ.id, e.target.value.slice(0, 200))}
                    placeholder={tx.placeholder}
                    rows={4}
                    className="w-full rounded-xl px-4 py-3 text-[14px] resize-none outline-none transition-all"
                    style={{
                      border: '1.5px solid #E5E7EB',
                      color: '#111111',
                      background: '#fff',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  />
                  <p className="text-[11px] mt-1 text-right" style={{ color: '#9CA3AF' }}>
                    {((answers[currentQ.id] as string) || '').length}/200
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="text-[13px] mt-4" style={{ color: '#DC2626' }}>{error}</p>
          )}
        </div>
      </div>

      {/* Nav buttons */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ background: '#fff', borderTop: '1px solid #E5E7EB' }}
      >
        <button
          onClick={goBack}
          disabled={qIndex === 0}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded font-medium text-[13px] transition-all disabled:opacity-30"
          style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
          onMouseEnter={e => { if (qIndex > 0) e.currentTarget.style.background = '#F3F4F6' }}
          onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {tx.back}
        </button>

        <div className="flex items-center gap-2">
          {currentQ.optional && (
            <button
              onClick={goNext}
              className="px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
            >
              {tx.skip}
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canAdvance() || isPending}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded font-bold text-[13px] transition-all disabled:opacity-40"
            style={{ background: '#C41E3A', color: '#fff' }}
            onMouseEnter={e => { if (canAdvance()) e.currentTarget.style.background = '#9E1830' }}
            onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
          >
            {isPending ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : qIndex === totalQ - 1 ? (
              <>{tx.finish} <CheckCircle2 className="h-3.5 w-3.5" /></>
            ) : (
              <>{tx.next} <ChevronRight className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
