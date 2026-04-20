'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Star, CheckCircle2, ArrowRight,
  AlertCircle, X, Play
} from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'

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
    native: 'Near-native',
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
    native: 'Near-native',
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
              <th key={i} className="py-2 text-center font-medium min-w-[52px]" style={{ color: '#4B5563' }}>
                <div
                  className="text-[11px]"
                  style={{ color: i === 0 ? '#111111' : '#9CA3AF', fontWeight: i === 0 ? 700 : 400 }}
                >
                  {d.label}
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: i === 0 ? '#111111' : '#9CA3AF', fontWeight: i === 0 ? 700 : 400 }}
                >
                  {d.dayNum}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} style={{ borderTop: '1px solid #E5E7EB' }}>
              <td
                className="py-2 pr-3 text-right text-[11px] align-middle whitespace-nowrap"
                style={{ color: '#9CA3AF' }}
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
                        className="w-full rounded py-2 text-[10px] font-semibold transition-all"
                        style={
                          isSelected
                            ? { background: '#111111', color: '#F9F9F9' }
                            : disabled
                            ? { background: '#F3F4F6', color: '#9CA3AF', cursor: 'not-allowed' }
                            : { background: 'rgba(196,30,58,0.08)', color: '#C41E3A', cursor: 'pointer' }
                        }
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
  const router = useRouter()
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
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      {/* Back nav */}
      <div className="px-6 py-3" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <Link
          href={`/${lang}/dashboard/maestros`}
          className="text-[13px] transition-colors"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
        >
          {tx.back}
        </Link>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {isBooked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: '#F0FDF4', borderBottom: '1px solid #86EFAC' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: '#16A34A' }} />
              <div>
                <div className="text-[14px] font-semibold" style={{ color: '#16A34A' }}>{tx.booked}</div>
                <div className="text-[12px]" style={{ color: '#16A34A' }}>{tx.bookedSub}</div>
              </div>
            </div>
            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center gap-1.5 px-4 py-2 rounded font-semibold text-[12px] transition-all"
              style={{ background: '#16A34A', color: '#fff' }}
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
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {teacher.profile?.avatar_url ? (
                    <img
                      src={teacher.profile.avatar_url}
                      alt={name}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-xl flex items-center justify-center font-bold text-xl"
                      style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                    >
                      {getInitials(teacher.profile?.full_name)}
                    </div>
                  )}
                  {teacher.is_active && (
                    <div
                      className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{ background: '#16A34A' }}
                    />
                  )}
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-[18px] font-black" style={{ color: '#111111' }}>{name}</h1>
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {tx.professionalTeacher}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{tx.teaches}</span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded font-medium"
                      style={{ background: '#F3F4F6', color: '#4B5563' }}
                    >
                      English
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded font-medium"
                      style={{ background: '#111111', color: '#F9F9F9' }}
                    >
                      {tx.native}
                    </span>
                    <span className="text-[11px]" style={{ color: '#E5E7EB' }}>|</span>
                    <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{tx.speaks}</span>
                    {teacher.specializations.slice(0, 3).map(s => (
                      <span
                        key={s}
                        className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
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
                style={{ borderTop: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4" style={{ color: '#C41E3A', fill: '#C41E3A' }} />
                  <span className="text-[15px] font-black" style={{ color: '#111111' }}>
                    {teacher.rating != null ? teacher.rating.toFixed(1) : '—'}
                  </span>
                  <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.rating}</span>
                </div>
                <span style={{ color: '#E5E7EB' }}>|</span>
                <div>
                  <span className="text-[15px] font-black" style={{ color: '#111111' }}>
                    {Math.max(0, Math.floor((teacher.total_sessions ?? 0) * 0.6))}
                  </span>
                  <span className="text-[11px] ml-1" style={{ color: '#9CA3AF' }}>{tx.students}</span>
                </div>
                <span style={{ color: '#E5E7EB' }}>|</span>
                <div>
                  <span className="text-[15px] font-black" style={{ color: '#111111' }}>{teacher.total_sessions ?? 0}</span>
                  <span className="text-[11px] ml-1" style={{ color: '#9CA3AF' }}>{tx.sessions}</span>
                </div>
                <span style={{ color: '#E5E7EB' }}>|</span>
                <div>
                  <span className="text-[15px] font-black" style={{ color: '#111111' }}>—</span>
                  <span className="text-[11px] ml-1" style={{ color: '#9CA3AF' }}>{tx.attendance}</span>
                </div>
                <span style={{ color: '#E5E7EB' }}>|</span>
                <div>
                  <span className="text-[15px] font-black" style={{ color: '#111111' }}>—</span>
                  <span className="text-[11px] ml-1" style={{ color: '#9CA3AF' }}>{tx.response}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-6 mt-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
                {([['about', tx.about], ['asTeacher', tx.asTeacher]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className="pb-3 text-[13px] font-medium transition-colors border-b-2 -mb-px"
                    style={{
                      borderBottomColor: activeTab === key ? '#111111' : 'transparent',
                      color: activeTab === key ? '#111111' : '#9CA3AF',
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
                          className="text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: '#9CA3AF' }}
                        >
                          {tx.specialty}:
                        </span>
                        {teacher.specializations.map(s => (
                          <span
                            key={s}
                            className="text-[11px] px-2.5 py-1 rounded font-medium"
                            style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
                      {teacher.bio || tx.noBio}
                    </p>
                  </div>
                )}
                {activeTab === 'asTeacher' && (
                  <div>
                    <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
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
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <h2 className="text-[15px] font-bold mb-4" style={{ color: '#111111' }}>{tx.lessons}</h2>
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between p-4 rounded transition-all"
                  style={{ border: '1px solid #E5E7EB' }}
                >
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>{tx.trialLesson}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>50 min · {tx.trialInfo}</div>
                  </div>
                  <span
                    className="text-[13px] font-bold px-3 py-1.5 rounded"
                    style={{ background: '#FEF9EE', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.08)' }}
                  >
                    {convert(teacher.hourly_rate * 0.5)}+
                  </span>
                </div>
                {teacher.specializations.slice(0, 1).map(spec => (
                  <div
                    key={spec}
                    className="flex items-center justify-between p-4 rounded transition-all"
                    style={{ border: '1px solid #E5E7EB' }}
                  >
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>{spec}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                        {lang === 'es' ? 'A1 - C2 · 50 min · Todas las edades' : 'A1 - C2 · 50 min · All ages'}
                      </div>
                    </div>
                    <span
                      className="text-[13px] font-bold px-3 py-1.5 rounded"
                      style={{ background: '#FEF9EE', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.08)' }}
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
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <h2 className="text-[15px] font-bold mb-1" style={{ color: '#111111' }}>{tx.availability}</h2>
              <p className="text-[12px] mb-4" style={{ color: '#9CA3AF' }}>{tx.scheduleSubtitle}</p>

              {classesRemaining <= 0 && (
                <div
                  className="mb-4 rounded p-3 flex items-center gap-3"
                  style={{ background: '#FEF9EE', border: '1px solid rgba(196,30,58,0.08)' }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#C41E3A' }} />
                  <p className="text-[12px] flex-1" style={{ color: '#4B5563' }}>{tx.noClasses}</p>
                  <Link
                    href={`/${lang}/dashboard/plan`}
                    className="text-[11px] font-bold underline flex-shrink-0 transition-colors"
                    style={{ color: '#C41E3A' }}
                  >
                    {tx.upgradePlan}
                  </Link>
                </div>
              )}

              {availabilitySlots.length === 0 ? (
                <p className="text-[13px] py-6 text-center" style={{ color: '#9CA3AF' }}>{tx.noSlots}</p>
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
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="relative aspect-video flex items-center justify-center"
                style={{ background: '#111111' }}
              >
                {teacher.profile?.avatar_url ? (
                  <img
                    src={teacher.profile.avatar_url}
                    alt={name}
                    className="w-full h-full object-cover opacity-70"
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: '#111111' }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(250,247,242,0.15)', border: '1px solid rgba(250,247,242,0.3)' }}
                  >
                    <Play className="h-5 w-5 ml-0.5" style={{ color: '#F9F9F9', fill: '#F9F9F9' }} />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[13px] font-medium" style={{ color: '#4B5563' }}>{tx.trialLesson}</span>
                  <span className="text-[16px] font-black" style={{ color: '#111111' }}>
                    {convert(teacher.hourly_rate * 0.5)}
                  </span>
                </div>

                <button
                  onClick={() => availabilitySlots.length > 0 && classesRemaining > 0 && setShowConfirm(true)}
                  disabled={classesRemaining <= 0}
                  className="w-full py-3 rounded font-bold text-[13px] transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (classesRemaining > 0) e.currentTarget.style.background = '#9E1830' }}
                  onMouseLeave={e => { if (classesRemaining > 0) e.currentTarget.style.background = '#C41E3A' }}
                >
                  {tx.book}
                </button>

                <button
                  className="w-full py-3 rounded text-[13px] font-medium transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                >
                  {tx.contact}
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div
              className="rounded-xl p-4"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div className="space-y-2.5">
                {[
                  [tx.sessions, (teacher.total_sessions ?? 0).toString()],
                  [tx.rating, teacher.rating != null ? teacher.rating.toFixed(1) : '—'],
                  [tx.attendance, '—'],
                  [tx.response, '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="text-[13px] font-semibold" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && selectedSlot && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(28,19,8,0.4)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {[
                  [tx.confirmWith, name],
                  [lang === 'es' ? 'Día' : 'Day', tx.days[selectedSlot.day_of_week]],
                  [tx.confirmAt, selectedSlot.start_time.slice(0, 5)],
                  [tx.confirmDuration, tx.confirmDurationVal],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div
                  className="mx-6 mb-4 rounded p-3 text-[12px]"
                  style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded font-medium text-[13px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-bold text-[13px] transition-all disabled:opacity-60"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                  onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
