'use client'

import { useState, useTransition, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { saveSurveyAnswers, bookPlacementCall, reschedulePlacementCall } from '@/app/actions/placement'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import Modal from '@/components/dashboard/Modal'

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
  { id: 'goals', type: 'multi', en: 'Why do you want to learn English?', es: '¿Por qué quieres aprender inglés?',
    options: [
      { id: 'work', en: 'Work', es: 'Para el trabajo' },
      { id: 'travel', en: 'Travel', es: 'Para viajar' },
      { id: 'studies', en: 'Studies', es: 'Para mis estudios' },
      { id: 'growth', en: 'Personal growth', es: 'Crecimiento personal' },
      { id: 'emigrate', en: 'Move abroad', es: 'Quiero emigrar' },
      { id: 'other', en: 'Other', es: 'Otro' },
    ],
  },
  { id: 'level', type: 'single', en: 'How much English do you know?', es: '¿Cuánto inglés sabes?',
    options: [
      { id: 'zero', en: "Zero — I don't know any English", es: 'Cero — no sé nada' },
      { id: 'beginner', en: 'Beginner — I know some words', es: 'Principiante — sé algunas palabras' },
      { id: 'elementary', en: 'Elementary — I can write simple sentences', es: 'Elemental — puedo escribir oraciones simples' },
      { id: 'intermediate', en: 'Intermediate — I can hold a basic conversation', es: 'Intermedio — puedo mantener una conversación básica' },
      { id: 'advanced', en: "Advanced — I'm fluent but want to improve", es: 'Avanzado — soy fluido pero quiero mejorar' },
    ],
  },
  { id: 'speaking', type: 'single', en: 'Can you speak English right now?', es: '¿Puedes hablar inglés ahora mismo?',
    options: [
      { id: 'yes', en: 'Yes, confidently', es: 'Sí, con confianza' },
      { id: 'a_little', en: 'A little', es: 'Un poco' },
      { id: 'not_really', en: 'Not really', es: 'No mucho' },
      { id: 'not_at_all', en: 'Not at all', es: 'Para nada' },
    ],
  },
  { id: 'frequency', type: 'single', en: 'How often do you currently study or practice English?', es: '¿Qué tan seguido estudias o practicas inglés?',
    options: [
      { id: 'daily', en: 'Daily', es: 'Todos los días' },
      { id: 'weekly', en: 'A few times a week', es: 'Algunas veces a la semana' },
      { id: 'rarely', en: 'Rarely', es: 'Rara vez' },
      { id: 'never', en: 'Never', es: 'Nunca' },
    ],
  },
  { id: 'style', type: 'single', en: 'How do you learn best?', es: '¿Cómo aprendes mejor?',
    options: [
      { id: 'listening', en: 'Listening', es: 'Escuchando' },
      { id: 'reading', en: 'Reading', es: 'Leyendo' },
      { id: 'speaking', en: 'Speaking', es: 'Hablando' },
      { id: 'writing', en: 'Writing', es: 'Escribiendo' },
      { id: 'mixed', en: 'Mixed', es: 'Combinado' },
    ],
  },
  { id: 'pace', type: 'single', en: 'How fast do you want to progress?', es: '¿Qué tan rápido quieres avanzar?',
    options: [
      { id: 'relaxed', en: 'Relaxed — 1–2 classes per week', es: 'Tranquilo — 1-2 clases por semana' },
      { id: 'steady', en: 'Steady — 3 classes per week', es: 'Constante — 3 clases por semana' },
      { id: 'intensive', en: 'Intensive — every day if possible', es: 'Intensivo — todos los días si es posible' },
    ],
  },
  { id: 'notes', type: 'text', optional: true,
    en: 'Anything else you want your teacher to know before your first class?',
    es: '¿Hay algo más que quieras que tu maestro sepa antes de tu primera clase?',
  },
]

interface BusinessDay {
  isoDate: string
  labelEs: string
  labelEn: string
  shortLabel: string
  slots: string[]
}

function generateBusinessDays(count = 7): BusinessDay[] {
  const days: BusinessDay[] = []
  const nowMs = Date.now()
  const minMs = nowMs + 24 * 60 * 60 * 1000
  let offset = 1
  while (days.length < count && offset <= 45) {
    const targetMs = nowMs + offset * 86400000
    const hnMs = targetMs - 6 * 3600000
    const hn = new Date(hnMs)
    const yr = hn.getUTCFullYear()
    const mo = hn.getUTCMonth()
    const dy = hn.getUTCDate()
    const slots: string[] = []
    for (let h = 0; h < 24; h++) {
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

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: 'easeOut' as const } },
  exit: (dir: number) => ({ x: dir * -50, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' as const } }),
}

const ui = {
  en: {
    title: 'Placement',
    flourish: 'discovery class',
    subtitle: 'Step 1 of 3 · 30-60 min · Free · No pressure',
    step: (n: number, t: number) => `Question ${n} of ${t}`,
    multi: 'Select all that apply',
    back: 'Back',
    next: 'Next',
    finish: 'Done',
    skip: 'Skip',
    transTitle: 'Perfect!',
    transSub: "Now let's schedule your free discovery class.",
    transBody: "Not sure what your level is? In your discovery class we'll figure it out together — no pressure, no judgment.",
    scheduleBtn: 'Schedule my discovery class',
    scheduleKicker: '↳ Pick a day & time',
    pickDay: 'Select a day',
    pickTime: 'Pick a time',
    noSlots: 'No available slots for this day.',
    timezone: 'All times in Honduras time (CST, UTC-6)',
    confirmTitle: 'Confirm your discovery class',
    confirmDate: 'Date & time',
    confirmDuration: 'Duration',
    confirmDurationVal: '60 minutes · Free',
    confirmNote: "We'll reach out through the platform when it's class time.",
    confirmBtn: 'Confirm',
    confirming: 'Scheduling…',
    cancelBtn: 'Cancel',
    confirmedKicker: '↳ Discovery class',
    confirmedTitle: "You're all set",
    confirmedSub: 'Your free discovery class is scheduled for:',
    confirmedNote: "You'll receive a confirmation email shortly. We'll reach out through the platform at class time.",
    backDash: 'Back to dashboard',
    editAnswers: '‹ Edit my answers',
    alreadyTitle: 'Discovery class already scheduled',
    alreadySub: 'Your free discovery class is scheduled for:',
    placeholder: 'Optional — max 200 characters',
  },
  es: {
    title: 'Placement',
    flourish: 'clase de descubrimiento',
    subtitle: 'Paso 1 de 3 · 30-60 min · Gratis · Sin presión',
    step: (n: number, t: number) => `Pregunta ${n} de ${t}`,
    multi: 'Selecciona todas las que apliquen',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Listo',
    skip: 'Omitir',
    transTitle: '¡Perfecto!',
    transSub: 'Ahora agenda tu clase de descubrimiento gratuita.',
    transBody: '¿No sabes cuál es tu nivel? En tu clase de descubrimiento lo averiguamos juntos — sin presión, sin juicios.',
    scheduleBtn: 'Agendar mi clase de descubrimiento',
    scheduleKicker: '↳ Elige día y hora',
    pickDay: 'Selecciona el día',
    pickTime: 'Elige un horario',
    noSlots: 'Sin horarios disponibles para este día.',
    timezone: 'Horarios en hora de Honduras (CST, UTC-6)',
    confirmTitle: 'Confirmar tu clase de descubrimiento',
    confirmDate: 'Fecha y hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '60 minutos · Gratis',
    confirmNote: 'Te contactaremos por la plataforma a la hora de la clase.',
    confirmBtn: 'Confirmar',
    confirming: 'Agendando…',
    cancelBtn: 'Cancelar',
    confirmedKicker: '↳ Clase de descubrimiento',
    confirmedTitle: 'Todo listo',
    confirmedSub: 'Tu clase de descubrimiento gratuita está agendada para:',
    confirmedNote: 'Recibirás un correo de confirmación en breve. Nos comunicaremos contigo en el horario acordado.',
    backDash: 'Volver al dashboard',
    editAnswers: '‹ Editar mis respuestas',
    alreadyTitle: 'Clase de descubrimiento ya agendada',
    alreadySub: 'Tu clase de descubrimiento gratuita está programada para:',
    placeholder: 'Opcional — máx. 200 caracteres',
  },
}

interface Props {
  lang: Locale
  studentId: string
  existingAnswers: Record<string, unknown> | null
  existingBooking: { id: string; scheduledAt: string; status: string } | null
  isReschedule?: boolean
}

type Answers = Record<string, string | string[]>
type Stage = 'survey' | 'transition' | 'schedule' | 'confirmed'

export default function PlacementClient({
  lang,
  existingAnswers,
  existingBooking,
  isReschedule,
}: Props) {
  const tx = ui[lang]
  const accent = 'var(--ek-red)'

  const initialStage: Stage = existingBooking
    ? 'confirmed'
    : isReschedule || existingAnswers
      ? 'schedule'
      : 'survey'

  const [stage, setStage] = useState<Stage>(initialStage)
  const [qIndex, setQIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [answers, setAnswers] = useState<Answers>((existingAnswers as Answers) || {})
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(existingBooking?.scheduledAt || null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const businessDays = useMemo(() => generateBusinessDays(7), [])
  const totalQ = QUESTIONS.length
  const currentQ = QUESTIONS[qIndex]

  function toggleMulti(qId: string, optId: string) {
    setAnswers((prev) => {
      const cur = (prev[qId] as string[] | undefined) || []
      const next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId]
      return { ...prev, [qId]: next }
    })
  }
  function setSingle(qId: string, optId: string) { setAnswers((p) => ({ ...p, [qId]: optId })) }
  function setText(qId: string, val: string) { setAnswers((p) => ({ ...p, [qId]: val })) }

  function canAdvance(): boolean {
    if (currentQ.optional) return true
    const val = answers[currentQ.id]
    if (currentQ.type === 'multi') return Array.isArray(val) && val.length > 0
    if (currentQ.type === 'text') return true
    return typeof val === 'string' && val.length > 0
  }

  function goNext() {
    if (!canAdvance()) return
    if (qIndex < totalQ - 1) {
      setDir(1)
      setQIndex((q) => q + 1)
    } else {
      startTransition(async () => {
        const result = await saveSurveyAnswers(answers, lang)
        if (result?.error) setError(result.error)
        else setStage('transition')
      })
    }
  }
  function goBack() {
    if (qIndex === 0) return
    setDir(-1)
    setQIndex((q) => q - 1)
  }
  function goBackToSurvey() {
    setDir(-1)
    setQIndex(totalQ - 1)
    setStage('survey')
  }

  function handleConfirmBooking() {
    if (!selectedSlot) return
    setError('')
    startTransition(async () => {
      const result = isReschedule
        ? await reschedulePlacementCall(selectedSlot, lang)
        : await bookPlacementCall(selectedSlot, lang)
      if (result?.error) setError(result.error)
      else {
        setConfirmedAt(selectedSlot)
        setShowModal(false)
        setStage('confirmed')
      }
    })
  }

  // ── Confirmed ─────────────────────────────────────────────────
  if (stage === 'confirmed') {
    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar
          title={tx.title}
          sub={tx.subtitle}
        />
        <div
          style={{
            padding: 24,
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ width: '100%', maxWidth: 480 }}
          >
            <DarkHeroCard
              ghost="✓"
              ghostSize={240}
              ghostStyle={{ right: -20, top: -40 }}
              padding="32px 32px"
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-on-dark-muted)',
                  fontWeight: 700,
                  marginBottom: 14,
                  fontFamily: 'var(--ek-font-mono)',
                }}
              >
                {tx.confirmedKicker}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  color: 'var(--ek-on-dark)',
                  lineHeight: 1,
                }}
              >
                {existingBooking && confirmedAt === existingBooking.scheduledAt
                  ? tx.alreadyTitle
                  : tx.confirmedTitle}
              </h2>
              <p
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  color: 'var(--ek-on-dark-soft)',
                  lineHeight: 1.5,
                }}
              >
                {existingBooking && confirmedAt === existingBooking.scheduledAt ? tx.alreadySub : tx.confirmedSub}
              </p>
              {confirmedAt && (
                <div
                  style={{
                    marginTop: 18,
                    padding: '14px 18px',
                    background: 'rgba(244,239,230,0.10)',
                    border: '1px solid rgba(244,239,230,0.18)',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: 'var(--ek-on-dark-muted)',
                      marginBottom: 4,
                      fontFamily: 'var(--ek-font-mono)',
                    }}
                  >
                    {lang === 'es' ? 'Hora de Honduras (CST)' : 'Honduras time (CST)'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-on-dark)' }}>
                    {fmtBookingDate(confirmedAt, lang)}
                  </div>
                </div>
              )}
            </DarkHeroCard>
            <div
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderTopWidth: 0,
                borderRadius: '0 0 16px 16px',
                padding: '20px 24px',
                marginTop: -16,
                paddingTop: 32,
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ek-text-soft)', lineHeight: 1.55 }}>
                {tx.confirmedNote}
              </p>
              <Link
                href={`/${lang}/dashboard`}
                className="ek-btn ek-btn-red ek-btn-square"
                style={{ marginTop: 18, padding: '12px 20px', fontSize: 13, width: '100%', justifyContent: 'center' }}
              >
                {tx.backDash} →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Transition ─────────────────────────────────────────────────
  if (stage === 'transition') {
    return (
      <div
        style={{
          minHeight: '100%',
          background: 'var(--ek-paper)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ textAlign: 'center', maxWidth: 480 }}
        >
          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ek-text)',
              marginBottom: 12,
            }}
          >
            {tx.transTitle.replace(/!/g, '')}{' '}
            <span
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                color: accent,
              }}
            >
              !
            </span>
          </h2>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ek-text)', marginBottom: 8 }}>{tx.transSub}</p>
          <p style={{ fontSize: 15, color: 'var(--ek-text-soft)', marginBottom: 32, lineHeight: 1.55 }}>{tx.transBody}</p>
          <button
            onClick={() => setStage('schedule')}
            className="ek-btn ek-btn-red ek-btn-square"
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            {tx.scheduleBtn} →
          </button>
          <div style={{ marginTop: 20 }}>
            <button
              onClick={goBackToSurvey}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--ek-text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              {tx.editAnswers.replace('‹ ', '‹ ')}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Schedule ─────────────────────────────────────────────────
  if (stage === 'schedule') {
    const selectedDay = businessDays[selectedDayIdx]
    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar
          title={
            <span>
              {tx.title} <TitleFlourish>{tx.flourish}</TitleFlourish>
            </span>
          }
          sub={tx.subtitle}
        />

        <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
          {!isReschedule && (
            <button
              onClick={goBackToSurvey}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--ek-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 16,
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              {tx.editAnswers}
            </button>
          )}

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-red)',
              marginBottom: 12,
              fontFamily: 'var(--ek-font-mono)',
            }}
          >
            {tx.scheduleKicker} · {tx.timezone}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)', gap: 16 }}>
            {/* Day picker */}
            <div
              style={{
                background: 'var(--ek-card)',
                borderRadius: 14,
                border: '1px solid var(--ek-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--ek-paper)',
                  borderBottom: '1px solid var(--ek-border-soft)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontFamily: 'var(--ek-font-mono)',
                }}
              >
                {tx.pickDay}
              </div>
              {businessDays.map((day, i) => {
                const active = i === selectedDayIdx
                return (
                  <button
                    key={day.isoDate}
                    onClick={() => {
                      setSelectedDayIdx(i)
                      setSelectedSlot(null)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: active ? 'var(--ek-red-tint)' : 'var(--ek-card)',
                      borderBottom: '1px solid var(--ek-border-soft)',
                      borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: active ? accent : 'var(--ek-text)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {(lang === 'es' ? day.labelEs : day.labelEn).split(',')[0]}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ek-text-muted)',
                        textTransform: 'capitalize',
                        marginTop: 2,
                      }}
                    >
                      {(lang === 'es' ? day.labelEs : day.labelEn).split(',').slice(1).join(',').trim()}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Time slots */}
            <div
              style={{
                background: 'var(--ek-card)',
                borderRadius: 14,
                border: '1px solid var(--ek-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--ek-paper)',
                  borderBottom: '1px solid var(--ek-border-soft)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontFamily: 'var(--ek-font-mono)',
                }}
              >
                {tx.pickTime}
              </div>
              {!selectedDay?.slots.length ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{tx.noSlots}</p>
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                    gap: 8,
                  }}
                >
                  {selectedDay.slots.map((slot) => {
                    const isSelected = selectedSlot === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setShowModal(true)
                          setError('')
                        }}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          background: isSelected ? accent : 'var(--ek-paper)',
                          color: isSelected ? '#fff' : 'var(--ek-text)',
                          border: isSelected ? 0 : '1px solid var(--ek-border)',
                          cursor: 'pointer',
                          fontFamily: 'var(--ek-font-mono)',
                          fontFeatureSettings: '"tnum"',
                        }}
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

        {/* Confirm modal — shared centered Modal (portaled to body) */}
        <Modal
          open={showModal && !!selectedSlot}
          onClose={() => !isPending && setShowModal(false)}
          kicker={tx.confirmedKicker}
          title={tx.confirmTitle}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => !isPending && setShowModal(false)}
                disabled={isPending}
                className="ek-btn ek-btn-ghost ek-btn-square"
                style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
              >
                {tx.cancelBtn}
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={isPending}
                className="ek-btn ek-btn-red ek-btn-square"
                style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center', opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? tx.confirming : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {tx.confirmBtn}
                  </>
                )}
              </button>
            </div>
          }
        >
          {selectedSlot && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                [tx.confirmDate, fmtBookingDate(selectedSlot, lang)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--ek-text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--ek-text)', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                {tx.confirmNote}
              </p>
              {error && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 12,
                    fontSize: 12,
                    borderRadius: 'var(--ek-radius-md)',
                    background: 'var(--ek-red-tint)',
                    border: '1px solid var(--ek-red-tint-3)',
                    color: 'var(--ek-red)',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // ── Survey ─────────────────────────────────────────────────
  const progress = (qIndex / totalQ) * 100

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'var(--ek-paper)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div
        style={{
          padding: '20px 36px',
          background: 'var(--ek-card)',
          borderBottom: '1px solid var(--ek-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>
            {tx.step(qIndex + 1, totalQ)}
          </p>
          <p style={{ fontSize: 12, fontWeight: 800, color: accent }}>
            {Math.round(progress + 100 / totalQ)}%
          </p>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--ek-paper)', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: accent, borderRadius: 3 }}
            animate={{ width: `${progress + 100 / totalQ}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={qIndex}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <h2
                style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  color: 'var(--ek-text)',
                  marginBottom: currentQ.type === 'multi' ? 6 : 24,
                  lineHeight: 1.25,
                }}
              >
                {lang === 'es' ? currentQ.es : currentQ.en}
              </h2>
              {currentQ.type === 'multi' && (
                <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', marginBottom: 24 }}>{tx.multi}</p>
              )}

              {currentQ.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {currentQ.options.map((opt) => {
                    const val = answers[currentQ.id]
                    const isActive = currentQ.type === 'multi'
                      ? Array.isArray(val) && val.includes(opt.id)
                      : val === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (currentQ.type === 'multi') toggleMulti(currentQ.id, opt.id)
                          else setSingle(currentQ.id, opt.id)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          width: '100%',
                          padding: '16px 20px',
                          borderRadius: 12,
                          textAlign: 'left',
                          background: isActive ? 'var(--ek-red-tint)' : 'var(--ek-card)',
                          border: `1.5px solid ${isActive ? accent : 'var(--ek-border)'}`,
                          cursor: 'pointer',
                          fontFamily: 'var(--ek-font-sans)',
                        }}
                      >
                        <div
                          style={{
                            flexShrink: 0,
                            width: 20,
                            height: 20,
                            borderRadius: currentQ.type === 'multi' ? 4 : '50%',
                            background: isActive ? accent : 'transparent',
                            border: `1.5px solid ${isActive ? accent : 'var(--ek-border-mid)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isActive && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              {currentQ.type === 'multi' ? (
                                <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              ) : (
                                <circle cx="5" cy="5" r="2.5" fill="#fff" />
                              )}
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ek-text)' }}>
                          {lang === 'es' ? opt.es : opt.en}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {currentQ.type === 'text' && (
                <div>
                  <textarea
                    value={(answers[currentQ.id] as string) || ''}
                    onChange={(e) => setText(currentQ.id, e.target.value.slice(0, 200))}
                    placeholder={tx.placeholder}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 12,
                      fontSize: 14,
                      resize: 'none',
                      outline: 'none',
                      border: '1.5px solid var(--ek-border)',
                      color: 'var(--ek-text)',
                      background: 'var(--ek-card)',
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--ek-text-muted)', textAlign: 'right', marginTop: 4 }}>
                    {((answers[currentQ.id] as string) || '').length}/200
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {error && <p style={{ fontSize: 13, color: 'var(--ek-red)', marginTop: 14 }}>{error}</p>}
        </div>
      </div>

      <div
        style={{
          padding: '20px 36px',
          background: 'var(--ek-card)',
          borderTop: '1px solid var(--ek-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={goBack}
          disabled={qIndex === 0}
          className="ek-btn ek-btn-ghost ek-btn-square"
          style={{
            padding: '10px 18px',
            fontSize: 13,
            opacity: qIndex === 0 ? 0.3 : 1,
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {tx.back}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentQ.optional && (
            <button
              onClick={goNext}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--ek-text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '10px 14px',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              {tx.skip}
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canAdvance() || isPending}
            className="ek-btn ek-btn-red ek-btn-square"
            style={{
              padding: '10px 22px',
              fontSize: 13,
              opacity: !canAdvance() || isPending ? 0.4 : 1,
            }}
          >
            {qIndex === totalQ - 1 ? (
              <>
                {tx.finish}
                <CheckCircle2 className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {tx.next}
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
