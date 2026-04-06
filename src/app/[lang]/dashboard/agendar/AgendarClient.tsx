'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, CheckCircle2, ArrowRight, X, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

interface Slot {
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
  rating: number
  total_sessions: number
  profile: { full_name: string | null; avatar_url: string | null } | null
  slots: Slot[]
}

interface Props {
  lang: Locale
  studentId: string
  classesRemaining: number
  teachers: Teacher[]
}

const t = {
  en: {
    title: 'Schedule a Class',
    subtitle: 'Pick a time that works for you. All classes are 50 minutes.',
    classesLeft: (n: number) => `${n} class${n !== 1 ? 'es' : ''} remaining`,
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    noSlots: 'No slots available this week.',
    confirmTitle: 'Confirm Booking',
    confirmWith: 'Teacher',
    confirmDate: 'Date',
    confirmTime: 'Time',
    confirmDuration: 'Duration',
    confirmDurationVal: '50 min',
    confirm: 'Confirm Booking',
    cancel: 'Cancel',
    booking: 'Booking…',
    successTitle: 'Booked!',
    successSub: 'Your teacher will confirm within 24 hours.',
    viewClasses: 'View my classes',
    bookAnother: 'Book another',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    notice24h: 'Requires 24+ hours notice',
    teacher: 'Teacher',
    rating: 'rating',
    sessions: 'sessions',
    with: 'with',
  },
  es: {
    title: 'Agendar Clase',
    subtitle: 'Elige un horario que funcione para ti. Todas las clases son de 50 minutos.',
    classesLeft: (n: number) => `${n} clase${n !== 1 ? 's' : ''} disponible${n !== 1 ? 's' : ''}`,
    prevWeek: 'Semana anterior',
    nextWeek: 'Semana siguiente',
    noSlots: 'Sin horarios disponibles esta semana.',
    confirmTitle: 'Confirmar Reserva',
    confirmWith: 'Maestro',
    confirmDate: 'Fecha',
    confirmTime: 'Hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '50 min',
    confirm: 'Confirmar Reserva',
    cancel: 'Cancelar',
    booking: 'Reservando…',
    successTitle: '¡Reservada!',
    successSub: 'Tu maestro confirmará en las próximas 24 horas.',
    viewClasses: 'Ver mis clases',
    bookAnother: 'Agendar otra',
    days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    notice24h: 'Requiere 24+ horas de anticipación',
    teacher: 'Maestro',
    rating: 'calificación',
    sessions: 'sesiones',
    with: 'con',
  },
}

interface SlotWithTeacher extends Slot {
  teacher: Teacher
  date: Date
  scheduledAt: string
  isPast: boolean
}

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

function buildSlotsForWeek(teachers: Teacher[], weekDates: Date[]): SlotWithTeacher[] {
  const now = Date.now()
  const minMs = now + 24 * 60 * 60 * 1000
  const result: SlotWithTeacher[] = []

  for (const teacher of teachers) {
    for (const slot of teacher.slots) {
      const date = weekDates.find(d => d.getDay() === slot.day_of_week)
      if (!date) continue

      const [h, m] = slot.start_time.split(':').map(Number)
      const slotDate = new Date(date)
      slotDate.setHours(h, m, 0, 0)

      result.push({
        ...slot,
        teacher,
        date: slotDate,
        scheduledAt: slotDate.toISOString(),
        isPast: slotDate.getTime() < minMs,
      })
    }
  }

  // Sort by time
  return result.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'T'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

interface SelectedSlot {
  slot: SlotWithTeacher
}

export default function AgendarClient({ lang, studentId, classesRemaining, teachers }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedSlot | null>(null)
  const [error, setError] = useState('')
  const [bookedSlot, setBookedSlot] = useState<SlotWithTeacher | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const slotsThisWeek = useMemo(() => buildSlotsForWeek(teachers, weekDates), [teachers, weekDates])

  // Group slots by day for the grid
  const slotsByDay = useMemo(() => {
    const map: Record<number, SlotWithTeacher[]> = {}
    for (const s of slotsThisWeek) {
      const dow = s.date.getDay()
      if (!map[dow]) map[dow] = []
      map[dow].push(s)
    }
    return map
  }, [slotsThisWeek])

  function handleConfirm() {
    if (!selected) return
    setError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('teacher_id', selected.slot.teacher.id)
      fd.set('slot_id', selected.slot.id)
      fd.set('scheduled_at', selected.slot.scheduledAt)
      fd.set('duration_minutes', '50')
      fd.set('lang', lang)
      const result = await createBooking(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setBookedSlot(selected.slot)
        setSelected(null)
      }
    })
  }

  // ── Booked success screen ─────────────────────────────────────
  if (bookedSlot) {
    const teacherName = bookedSlot.teacher.profile?.full_name || 'Teacher'
    return (
      <div className="min-h-full flex flex-col" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-[420px] rounded-2xl overflow-hidden text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
          >
            <div className="py-8 px-6" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[22px] font-black text-white mb-1">{tx.successTitle}</h2>
              <p className="text-[14px] text-white/80">{tx.successSub}</p>
            </div>

            <div className="p-6 space-y-3">
              {[
                [tx.confirmWith, teacherName],
                [tx.confirmDate, bookedSlot.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })],
                [tx.confirmTime, bookedSlot.start_time.slice(0, 5)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-[13px]">
                  <span style={{ color: '#9CA3AF' }}>{label}</span>
                  <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                </div>
              ))}

              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setBookedSlot(null)}
                  className="flex-1 py-3 rounded-lg font-medium text-[13px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#4B5563' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {tx.bookAnother}
                </button>
                <button
                  onClick={() => router.push(`/${lang}/dashboard/clases`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
                >
                  {tx.viewClasses}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      {/* Header */}
      <div
        className="px-8 py-6 flex items-center justify-between"
        style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
      >
        <div>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.12)' }}
        >
          <Calendar className="h-4 w-4" style={{ color: '#C41E3A' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#C41E3A' }}>
            {tx.classesLeft(classesRemaining)}
          </span>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-30"
            style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
            onMouseEnter={e => { if (weekOffset > 0) e.currentTarget.style.background = '#F9F9F9' }}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {tx.prevWeek}
          </button>

          <div className="text-center">
            <p className="text-[13px] font-bold" style={{ color: '#111111' }}>
              {weekDates[0].toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
              {tx.notice24h}
            </p>
          </div>

          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
            style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            {tx.nextWeek}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Calendar grid */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div key={i} className="py-3 text-center">
                  <p
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: isToday ? '#C41E3A' : '#9CA3AF' }}
                  >
                    {tx.days[date.getDay()]}
                  </p>
                  <p
                    className="text-[16px] font-black mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto"
                    style={isToday
                      ? { background: '#C41E3A', color: '#fff' }
                      : { color: '#111111' }
                    }
                  >
                    {date.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Slots grid */}
          {slotsThisWeek.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noSlots}</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x" style={{ borderColor: '#F3F4F6', minHeight: '320px' }}>
              {weekDates.map((date, colIdx) => {
                const dow = date.getDay()
                const daySlots = (slotsByDay[dow] || []).filter(s => {
                  // Match this specific date (not just day of week)
                  return s.date.toDateString() === date.toDateString()
                })

                return (
                  <div key={colIdx} className="p-2 space-y-1.5" style={{ borderRight: colIdx < 6 ? '1px solid #F3F4F6' : 'none' }}>
                    {daySlots.map(slot => {
                      const tName = slot.teacher.profile?.full_name || 'Teacher'
                      const isSelected = selected?.slot.id === slot.id && selected?.slot.scheduledAt === slot.scheduledAt
                      const isPast = slot.isPast

                      return (
                        <button
                          key={`${slot.id}-${slot.scheduledAt}`}
                          onClick={() => {
                            if (!isPast) {
                              setSelected({ slot })
                              setError('')
                            }
                          }}
                          disabled={isPast}
                          className="w-full rounded-lg p-2 text-left transition-all"
                          style={
                            isPast
                              ? { background: '#F9FAFB', cursor: 'not-allowed', opacity: 0.4 }
                              : isSelected
                              ? { background: '#111111', color: '#F9F9F9' }
                              : { background: 'rgba(196,30,58,0.06)', cursor: 'pointer' }
                          }
                        >
                          <p
                            className="text-[10px] font-bold"
                            style={{ color: isSelected ? '#fff' : '#C41E3A' }}
                          >
                            {slot.start_time.slice(0, 5)}
                          </p>
                          <p
                            className="text-[9px] truncate mt-0.5"
                            style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}
                          >
                            {tName.split(' ')[0]}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Teacher legend */}
        {teachers.length > 0 && (
          <div className="mt-4 flex items-center flex-wrap gap-3">
            {teachers.map(t => (
              <div key={t.id} className="flex items-center gap-1.5">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                  style={{ background: '#C41E3A' }}
                >
                  {getInitials(t.profile?.full_name)}
                </div>
                <span className="text-[11px]" style={{ color: '#6B7280' }}>
                  {t.profile?.full_name || 'Teacher'}
                </span>
                <div className="flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{t.rating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm booking modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isPending && setSelected(null)}
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
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: '#C41E3A' }} />
                  <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                </div>
                <button
                  onClick={() => !isPending && setSelected(null)}
                  disabled={isPending}
                  className="transition-colors disabled:opacity-40"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Teacher mini profile */}
              <div className="px-6 pt-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                  style={{ background: '#C41E3A' }}
                >
                  {getInitials(selected.slot.teacher.profile?.full_name)}
                </div>
                <div className="pb-4">
                  <p className="text-[13px] font-bold" style={{ color: '#111111' }}>
                    {selected.slot.teacher.profile?.full_name || 'Teacher'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#9CA3AF' }}>
                    <Star className="h-3 w-3" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                    {selected.slot.teacher.rating.toFixed(1)} · {selected.slot.teacher.total_sessions} {tx.sessions}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 space-y-3">
                {[
                  [tx.confirmDate, selected.slot.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })],
                  [tx.confirmTime, selected.slot.start_time.slice(0, 5)],
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
                  className="mx-6 mb-3 rounded p-3 text-[12px]"
                  style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => !isPending && setSelected(null)}
                  disabled={isPending}
                  className="flex-1 py-3 rounded-lg font-medium text-[13px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] transition-all disabled:opacity-60"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                  onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
                >
                  {isPending ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      {tx.booking}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tx.confirm}
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
