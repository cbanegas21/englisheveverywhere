'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, CheckCircle2, ArrowRight, AlertCircle, Play } from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'
import { StatLedger } from '@/components/ui/StatLedger'
import Modal from '@/components/dashboard/Modal'

interface AvailabilitySlot {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
}

interface Teacher {
  id: string
  bio: string | null
  hourly_rate: number
  specializations: string[]
  rating: number | null
  total_sessions: number | null
  is_active: boolean
  profile: { full_name: string | null; avatar_url: string | null } | null
}

interface Props {
  lang: Locale
  teacher: Teacher
  availabilitySlots: AvailabilitySlot[]
  studentId: string | null
  classesRemaining: number
}

const t = {
  en: {
    back: '← Back to teachers',
    book: 'Book lesson',
    contact: 'Contact teacher',
    sessions: 'Lessons',
    students: 'Students',
    rating: 'Rating',
    attendance: 'Attendance',
    response: 'Response',
    specialty: 'Specialties',
    about: 'About Me',
    asTeacher: 'Me as a Teacher',
    lessons: 'English Lessons',
    availability: 'Availability',
    schedule: 'Pick a time',
    scheduleSubtitle: 'Choose a time slot for your class.',
    noSlots: 'No availability set yet. Check back soon.',
    confirmTitle: 'Confirm booking',
    confirmKicker: '↳ Review the details',
    confirmWith: 'Class with',
    confirmAt: 'At',
    confirmDuration: 'Duration',
    confirmDurationVal: '50 min',
    confirm: 'Confirm booking',
    cancel: 'Cancel',
    noClasses: 'No classes remaining. Get a new pack.',
    upgradePlan: 'Get classes',
    booked: 'Booking confirmed!',
    bookedSub: 'Your teacher will confirm shortly.',
    viewDashboard: 'Go to dashboard',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    trialLesson: 'Trial Lesson',
    professionalTeacher: 'Certified Teacher',
    teaches: 'Teaches',
    speaks: 'Speaks',
    native: 'Fluent',
    noBio: 'Experienced certified English teacher ready to help you reach fluency.',
    trialInfo: 'trial lesson',
  },
  es: {
    back: '← Volver a maestros',
    book: 'Agendar clase',
    contact: 'Contactar maestro',
    sessions: 'Clases',
    students: 'Estudiantes',
    rating: 'Calificación',
    attendance: 'Asistencia',
    response: 'Respuesta',
    specialty: 'Especialidades',
    about: 'Sobre mí',
    asTeacher: 'Como maestro',
    lessons: 'Clases de inglés',
    availability: 'Disponibilidad',
    schedule: 'Elige un horario',
    scheduleSubtitle: 'Selecciona el día y la hora para tu clase.',
    noSlots: 'Sin disponibilidad. Vuelve pronto.',
    confirmTitle: 'Confirmar reserva',
    confirmKicker: '↳ Revisa los detalles',
    confirmWith: 'Clase con',
    confirmAt: 'A las',
    confirmDuration: 'Duración',
    confirmDurationVal: '50 min',
    confirm: 'Confirmar reserva',
    cancel: 'Cancelar',
    noClasses: 'Sin clases disponibles. Obtén un nuevo pack.',
    upgradePlan: 'Obtener clases',
    booked: '¡Reserva confirmada!',
    bookedSub: 'Tu maestro confirmará en breve.',
    viewDashboard: 'Ir al inicio',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    daysShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    trialLesson: 'Clase de prueba',
    professionalTeacher: 'Maestro Certificado',
    teaches: 'Enseña',
    speaks: 'Habla',
    native: 'Fluido',
    noBio: 'Maestro certificado con experiencia listo para ayudarte a alcanzar la fluidez.',
    trialInfo: 'clase de prueba',
  },
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'T'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function groupSlotsByDay(slots: AvailabilitySlot[]) {
  const map: Record<number, AvailabilitySlot[]> = {}
  for (const slot of slots) {
    if (!map[slot.day_of_week]) map[slot.day_of_week] = []
    map[slot.day_of_week].push(slot)
  }
  return map
}

function getNextDate(dayOfWeek: number): Date {
  const today = new Date()
  const diff = (dayOfWeek - today.getDay() + 7) % 7
  const result = new Date(today)
  result.setDate(today.getDate() + (diff === 0 ? 0 : diff))
  return result
}

function formatDateForBooking(date: Date, startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

function AvailabilityGrid({ slots, onSlotSelect, selectedSlot, disabled, daysShort }: {
  slots: AvailabilitySlot[]
  onSlotSelect: (slot: AvailabilitySlot) => void
  selectedSlot: AvailabilitySlot | null
  disabled: boolean
  daysShort: string[]
}) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return {
      dayOfWeek: d.getDay(),
      date: d,
      label: daysShort[d.getDay()],
      dayNum: d.getDate(),
    }
  })

  const byDay = groupSlotsByDay(slots)
  const times = [...new Set(slots.map(s => s.start_time))].sort()

  if (times.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr>
            <th className="w-16 py-2 text-left font-normal" />
            {days.map((d, i) => (
              <th key={i} className="py-2 text-center font-medium min-w-[52px]" style={{ color: 'var(--ek-text-soft)' }}>
                <div
                  className="text-[11px]"
                  style={{ color: i === 0 ? 'var(--ek-text)' : 'var(--ek-text-muted)', fontWeight: i === 0 ? 700 : 400 }}
                >
                  {d.label}
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: i === 0 ? 'var(--ek-text)' : 'var(--ek-text-muted)', fontWeight: i === 0 ? 700 : 400 }}
                >
                  {d.dayNum}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} style={{ borderTop: '1px solid var(--ek-border)' }}>
              <td
                className="py-2 pr-3 text-right text-[11px] align-middle whitespace-nowrap"
                style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}
              >
                {time.slice(0, 5)}
              </td>
              {days.map((d, i) => {
                const slot = byDay[d.dayOfWeek]?.find(s => s.start_time === time)
                const isSelected = selectedSlot?.id === slot?.id
                return (
                  <td key={i} className="py-1 px-1 text-center">
                    {slot ? (
                      <button
                        onClick={() => !disabled && onSlotSelect(slot)}
                        disabled={disabled}
                        className={`lk-tp-slot w-full py-2 text-[10px] font-semibold ${isSelected ? 'is-selected' : ''}`}
                        style={{ fontFamily: 'var(--ek-font-mono)' }}
                      >
                        {time.slice(0, 5)}
                      </button>
                    ) : (
                      <div className="w-full py-2" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TeacherProfileClient({
  lang, teacher, availabilitySlots, studentId, classesRemaining
}: Props) {
  const tx = t[lang]
  const { convert } = useCurrency()
  const [isPending, startTransition] = useTransition()
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isBooked, setIsBooked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'about' | 'asTeacher'>('about')

  function handleSlotSelect(slot: AvailabilitySlot) {
    if (classesRemaining <= 0) return
    setSelectedSlot(slot)
    setShowConfirm(true)
  }

  function handleConfirm() {
    if (!selectedSlot || !studentId) return
    setError(null)

    const nextDate = getNextDate(selectedSlot.day_of_week)
    const scheduledAt = formatDateForBooking(nextDate, selectedSlot.start_time)

    const formData = new FormData()
    formData.set('teacher_id', teacher.id)
    formData.set('slot_id', selectedSlot.id)
    formData.set('scheduled_at', scheduledAt)
    formData.set('duration_minutes', '50')
    formData.set('lang', lang)

    startTransition(async () => {
      const result = await createBooking(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setShowConfirm(false)
        setIsBooked(true)
      }
    })
  }

  const name = teacher.profile?.full_name || 'Teacher'

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      {/* Scoped hover rules — replace inline JS hover handlers (no shorthand/non-shorthand clash) */}
      <style>{`
        .lk-tp-back { color: var(--ek-text-muted); transition: color 0.18s ease; }
        .lk-tp-back:hover { color: var(--ek-text); }
        .lk-tp-slot {
          background: var(--ek-red-tint-2);
          color: var(--ek-red);
          cursor: pointer;
          border: 1px solid transparent;
          border-radius: var(--ek-radius-xs);
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .lk-tp-slot:hover { border-color: var(--ek-red); }
        .lk-tp-slot.is-selected { background: var(--ek-ink); color: var(--ek-on-dark); }
        .lk-tp-slot:disabled {
          background: var(--ek-paper-deep);
          color: var(--ek-text-muted);
          cursor: not-allowed;
          border-color: transparent;
        }
        .lk-tp-contact {
          border: 1px solid var(--ek-border-mid);
          color: var(--ek-text);
          background: var(--ek-paper);
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .lk-tp-contact:hover { background: var(--ek-paper-deep); border-color: var(--ek-ink); }
        .lk-tp-tab { color: var(--ek-text-muted); transition: color 0.18s ease; }
        .lk-tp-tab:hover { color: var(--ek-text); }
        .lk-tp-tab.is-active { color: var(--ek-text); }
      `}</style>

      {/* Back nav */}
      <div className="px-6 py-3" style={{ background: 'var(--ek-card)', borderBottom: '1px solid var(--ek-border)' }}>
        <Link
          href={`/${lang}/dashboard/maestros`}
          className="lk-tp-back text-[13px]"
          style={{ fontFamily: 'var(--ek-font-mono)', letterSpacing: '0.02em' }}
        >
          {tx.back}
        </Link>
      </div>

      {/* Success banner — genuine success state, brand success tokens */}
      <AnimatePresence>
        {isBooked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'var(--ek-success-bg)', borderBottom: '1px solid var(--ek-success-border)' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--ek-success-text)' }} />
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--ek-success-text)' }}>{tx.booked}</div>
                <div className="text-[12px]" style={{ color: 'var(--ek-success-text)' }}>{tx.bookedSub}</div>
              </div>
            </div>
            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center gap-1.5 px-4 py-2 font-semibold text-[12px]"
              style={{ background: 'var(--ek-success-text)', color: 'var(--ek-paper)', borderRadius: 'var(--ek-radius-xs)' }}
            >
              {tx.viewDashboard}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* MAIN COLUMN */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Profile card */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              <div className="flex items-start gap-5">
                {/* Avatar — squared, no icon-chip tint */}
                <div className="relative flex-shrink-0">
                  {teacher.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teacher.profile.avatar_url}
                      alt={name}
                      className="w-20 h-20 object-cover"
                      style={{ borderRadius: 'var(--ek-radius-md)' }}
                    />
                  ) : (
                    <div
                      className="w-20 h-20 flex items-center justify-center font-bold text-xl"
                      style={{
                        background: 'var(--ek-ink)',
                        color: 'var(--ek-on-dark)',
                        borderRadius: 'var(--ek-radius-md)',
                        fontFamily: 'var(--ek-font-serif)',
                        fontStyle: 'italic',
                      }}
                    >
                      {getInitials(teacher.profile?.full_name)}
                    </div>
                  )}
                  {teacher.is_active && (
                    <div
                      className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full"
                      style={{ background: 'var(--ek-success-dot)', border: '2px solid var(--ek-card)' }}
                    />
                  )}
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-[18px] font-black" style={{ color: 'var(--ek-text)', letterSpacing: '-0.02em' }}>{name}</h1>
                    {/* Certified — clean mono micro-tag, no pill, no icon-chip */}
                    <span
                      className="ek-microlabel"
                      style={{ color: 'var(--ek-success-text)' }}
                    >
                      {tx.professionalTeacher}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>{tx.teaches}</span>
                    <span
                      className="text-[11px] px-2 py-0.5 font-medium"
                      style={{ background: 'var(--ek-paper-deep)', color: 'var(--ek-text-soft)', borderRadius: 'var(--ek-radius-xs)' }}
                    >
                      English
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 font-medium"
                      style={{ background: 'var(--ek-ink)', color: 'var(--ek-on-dark)', borderRadius: 'var(--ek-radius-xs)' }}
                    >
                      {tx.native}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--ek-border-mid)' }}>|</span>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>{tx.speaks}</span>
                    {teacher.specializations.slice(0, 3).map(s => (
                      <span
                        key={s}
                        className="text-[11px] px-2 py-0.5 font-medium"
                        style={{ background: 'var(--ek-red-tint-2)', color: 'var(--ek-red)', borderRadius: 'var(--ek-radius-xs)' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats bar */}
              <div
                className="flex items-center gap-6 mt-5 pt-5 flex-wrap"
                style={{ borderTop: '1px solid var(--ek-border)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4" style={{ color: 'var(--ek-red)', fill: 'var(--ek-red)' }} />
                  <span className="text-[15px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>
                    {teacher.rating != null ? teacher.rating.toFixed(1) : '—'}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.rating}</span>
                </div>
                <span style={{ color: 'var(--ek-border-mid)' }}>|</span>
                <div>
                  <span className="text-[15px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>
                    {Math.max(0, Math.floor((teacher.total_sessions ?? 0) * 0.6))}
                  </span>
                  <span className="text-[11px] ml-1" style={{ color: 'var(--ek-text-muted)' }}>{tx.students}</span>
                </div>
                <span style={{ color: 'var(--ek-border-mid)' }}>|</span>
                <div>
                  <span className="text-[15px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>{teacher.total_sessions ?? 0}</span>
                  <span className="text-[11px] ml-1" style={{ color: 'var(--ek-text-muted)' }}>{tx.sessions}</span>
                </div>
                <span style={{ color: 'var(--ek-border-mid)' }}>|</span>
                <div>
                  <span className="text-[15px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>—</span>
                  <span className="text-[11px] ml-1" style={{ color: 'var(--ek-text-muted)' }}>{tx.attendance}</span>
                </div>
                <span style={{ color: 'var(--ek-border-mid)' }}>|</span>
                <div>
                  <span className="text-[15px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>—</span>
                  <span className="text-[11px] ml-1" style={{ color: 'var(--ek-text-muted)' }}>{tx.response}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-6 mt-5" style={{ borderBottom: '1px solid var(--ek-border)' }}>
                {([['about', tx.about], ['asTeacher', tx.asTeacher]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`lk-tp-tab pb-3 text-[13px] font-medium border-b-2 -mb-px ${activeTab === key ? 'is-active' : ''}`}
                    style={{
                      borderBottomColor: activeTab === key ? 'var(--ek-ink)' : 'transparent',
                      fontFamily: 'var(--ek-font-mono)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="mt-5">
                {activeTab === 'about' && (
                  <div>
                    {teacher.specializations.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span
                          className="ek-microlabel"
                          style={{ color: 'var(--ek-text-muted)' }}
                        >
                          {tx.specialty}:
                        </span>
                        {teacher.specializations.map(s => (
                          <span
                            key={s}
                            className="text-[11px] px-2.5 py-1 font-medium"
                            style={{ background: 'var(--ek-red-tint-2)', color: 'var(--ek-red)', borderRadius: 'var(--ek-radius-xs)' }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                      {teacher.bio || tx.noBio}
                    </p>
                  </div>
                )}
                {activeTab === 'asTeacher' && (
                  <div>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                      {lang === 'es'
                        ? `Con ${teacher.total_sessions} clases completadas, me especializo en ayudar a mis estudiantes a alcanzar sus metas de inglés de manera efectiva y personalizada.`
                        : `With ${teacher.total_sessions} completed lessons, I specialize in helping students achieve their English goals in an effective and personalized way.`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Lessons section */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{tx.lessons}</h2>
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between p-4"
                  style={{ border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-md)' }}
                >
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--ek-text)' }}>{tx.trialLesson}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>50 min · {tx.trialInfo}</div>
                  </div>
                  <span
                    className="text-[13px] font-bold px-3 py-1.5 ek-tnum"
                    style={{ background: 'var(--ek-red-tint)', color: 'var(--ek-red)', border: '1px solid var(--ek-red-tint-3)', borderRadius: 'var(--ek-radius-xs)' }}
                  >
                    {convert(teacher.hourly_rate * 0.5)}+
                  </span>
                </div>
                {teacher.specializations.slice(0, 1).map(spec => (
                  <div
                    key={spec}
                    className="flex items-center justify-between p-4"
                    style={{ border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-md)' }}
                  >
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--ek-text)' }}>{spec}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>
                        {lang === 'es' ? 'A1 - C2 · 50 min · Todas las edades' : 'A1 - C2 · 50 min · All ages'}
                      </div>
                    </div>
                    <span
                      className="text-[13px] font-bold px-3 py-1.5 ek-tnum"
                      style={{ background: 'var(--ek-red-tint)', color: 'var(--ek-red)', border: '1px solid var(--ek-red-tint-3)', borderRadius: 'var(--ek-radius-xs)' }}
                    >
                      {convert(teacher.hourly_rate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{tx.availability}</h2>
              <p className="text-[12px] mb-4" style={{ color: 'var(--ek-text-muted)' }}>{tx.scheduleSubtitle}</p>

              {classesRemaining <= 0 && (
                <div
                  className="mb-4 p-3 flex items-center gap-3"
                  style={{ background: 'var(--ek-red-tint)', border: '1px solid var(--ek-red-tint-3)', borderRadius: 'var(--ek-radius-md)' }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ek-red)' }} />
                  <p className="text-[12px] flex-1" style={{ color: 'var(--ek-text-soft)' }}>{tx.noClasses}</p>
                  <Link
                    href={`/${lang}/dashboard/plan`}
                    className="text-[11px] font-bold underline flex-shrink-0"
                    style={{ color: 'var(--ek-red)' }}
                  >
                    {tx.upgradePlan}
                  </Link>
                </div>
              )}

              {availabilitySlots.length === 0 ? (
                <p className="text-[13px] py-6 text-center" style={{ color: 'var(--ek-text-muted)' }}>{tx.noSlots}</p>
              ) : (
                <AvailabilityGrid
                  slots={availabilitySlots}
                  onSlotSelect={handleSlotSelect}
                  selectedSlot={selectedSlot}
                  disabled={classesRemaining <= 0}
                  daysShort={tx.daysShort}
                />
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-[280px] flex-shrink-0 sticky top-6 space-y-4">

            {/* Video/preview card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              <div
                className="relative aspect-video flex items-center justify-center"
                style={{ background: 'var(--ek-ink)' }}
              >
                {teacher.profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teacher.profile.avatar_url}
                    alt={name}
                    className="w-full h-full object-cover opacity-70"
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: 'var(--ek-ink)' }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--ek-on-dark-faint)', border: '1px solid rgba(244,239,230,0.3)' }}
                  >
                    <Play className="h-5 w-5 ml-0.5" style={{ color: 'var(--ek-on-dark)', fill: 'var(--ek-on-dark)' }} />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--ek-text-soft)' }}>{tx.trialLesson}</span>
                  <span className="text-[16px] font-black ek-tnum" style={{ color: 'var(--ek-text)' }}>
                    {convert(teacher.hourly_rate * 0.5)}
                  </span>
                </div>

                <button
                  onClick={() => availabilitySlots.length > 0 && classesRemaining > 0 && setShowConfirm(true)}
                  disabled={classesRemaining <= 0}
                  className="ek-btn ek-btn-red ek-btn-square w-full mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ justifyContent: 'center' }}
                >
                  {tx.book}
                </button>

                <button
                  className="lk-tp-contact w-full py-3 text-[13px] font-medium"
                  style={{ borderRadius: 'var(--ek-radius-md)' }}
                >
                  {tx.contact}
                </button>
              </div>
            </div>

            {/* Quick stats — editorial ledger replaces the boxed mini stat list */}
            <StatLedger
              items={[
                { kicker: tx.sessions, value: (teacher.total_sessions ?? 0).toString() },
                { kicker: tx.rating, value: teacher.rating != null ? teacher.rating.toFixed(1) : '—', accent: true },
                { kicker: tx.attendance, value: '—' },
                { kicker: tx.response, value: '—' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Confirm modal — shared centered Modal (framer no longer drifts the popup) */}
      <Modal
        open={showConfirm && !!selectedSlot}
        onClose={() => setShowConfirm(false)}
        kicker={tx.confirmKicker}
        title={tx.confirmTitle}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="ek-btn ek-btn-ghost ek-btn-square flex-1"
              style={{ justifyContent: 'center' }}
            >
              {tx.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="ek-btn ek-btn-red ek-btn-square flex-1 disabled:opacity-60"
              style={{ justifyContent: 'center' }}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  {lang === 'es' ? 'Reservando...' : 'Booking...'}
                </span>
              ) : (
                <>
                  {tx.confirm}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        }
      >
        {selectedSlot && (
          <div className="space-y-3">
            {[
              [tx.confirmWith, name],
              [lang === 'es' ? 'Día' : 'Day', tx.days[selectedSlot.day_of_week]],
              [tx.confirmAt, selectedSlot.start_time.slice(0, 5)],
              [tx.confirmDuration, tx.confirmDurationVal],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--ek-text-muted)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--ek-text)' }}>{value}</span>
              </div>
            ))}
            {error && (
              <div
                className="mt-2 p-3 text-[12px]"
                style={{ background: 'var(--ek-red-tint)', border: '1px solid var(--ek-red-tint-3)', color: 'var(--ek-red)', borderRadius: 'var(--ek-radius-xs)' }}
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
