'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, X, Calendar, Clock, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  lang: Locale
  studentId: string
  classesRemaining: number
  existingBookings: string[]
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const ROW_HEIGHT = 40

const t = {
  en: {
    title: 'Schedule a Class',
    subtitle: 'Pick any time that works for you. All classes are 60 minutes.',
    classesLeft: (n: number) => `${n} class${n !== 1 ? 'es' : ''} remaining`,
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    available: 'Available',
    confirmTitle: 'Confirm Booking',
    confirmDate: 'Date',
    confirmTime: 'Time',
    confirmDuration: 'Duration',
    confirmDurationVal: '60 min',
    confirm: 'Confirm Booking',
    cancel: 'Cancel',
    booking: 'Booking…',
    successTitle: 'Booked!',
    successSub: 'Your teacher will be assigned within 24 hours.',
    viewClasses: 'View my classes',
    bookAnother: 'Book another',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    notice24h: 'Requires 24+ hours notice',
    booked: 'Booked',
    tooSoon: 'Too soon',
    anyTimeNote: 'Book any time — a teacher is assigned after the booking.',
  },
  es: {
    title: 'Agendar Clase',
    subtitle: 'Elige cualquier horario que funcione para ti. Todas las clases son de 60 minutos.',
    classesLeft: (n: number) => `${n} clase${n !== 1 ? 's' : ''} disponible${n !== 1 ? 's' : ''}`,
    prevWeek: 'Semana anterior',
    nextWeek: 'Semana siguiente',
    available: 'Disponible',
    confirmTitle: 'Confirmar Reserva',
    confirmDate: 'Fecha',
    confirmTime: 'Hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '60 min',
    confirm: 'Confirmar Reserva',
    cancel: 'Cancelar',
    booking: 'Reservando…',
    successTitle: '¡Reservada!',
    successSub: 'Te asignaremos un maestro en las próximas 24 horas.',
    viewClasses: 'Ver mis clases',
    bookAnother: 'Agendar otra',
    days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    notice24h: 'Requiere 24+ horas de anticipación',
    booked: 'Agendada',
    tooSoon: 'Muy pronto',
    anyTimeNote: 'Agenda a cualquier hora — asignamos maestro después de la reserva.',
  },
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

function hourLabel(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

interface SelectedCell {
  date: Date
  hour: number
  scheduledAt: string
}

export default function AgendarClient({ lang, classesRemaining, existingBookings }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedCell | null>(null)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<SelectedCell | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 6 * ROW_HEIGHT
    }
  }, [weekOffset])

  const bookedSet = useMemo(() => {
    const set = new Set<string>()
    for (const iso of existingBookings) {
      const d = new Date(iso)
      set.add(`${d.toDateString()}-${d.getHours()}`)
    }
    return set
  }, [existingBookings])

  function handleConfirm() {
    if (!selected) return
    setError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('scheduled_at', selected.scheduledAt)
      fd.set('duration_minutes', '60')
      fd.set('lang', lang)
      const result = await createBooking(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setBooked(selected)
        setSelected(null)
      }
    })
  }

  // ── Success screen ─────────────────────────────────────────────
  if (booked) {
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
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[22px] font-black text-white mb-1">{tx.successTitle}</h2>
              <p className="text-[14px] text-white/80">{tx.successSub}</p>
            </div>
            <div className="p-6 space-y-3">
              {[
                [tx.confirmDate, booked.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })],
                [tx.confirmTime, hourLabel(booked.hour)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-[13px]">
                  <span style={{ color: '#9CA3AF' }}>{label}</span>
                  <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setBooked(null)}
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
      <div className="px-8 py-6 flex items-center justify-between" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.12)' }}>
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
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.notice24h}</p>
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

        {/* Any-time note */}
        <div className="mb-4 rounded-lg px-4 py-3 text-[12px]" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857' }}>
          {tx.anyTimeNote}
        </div>

        {/* Calendar grid — always 24h */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div key={i} className="py-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: isToday ? '#C41E3A' : '#9CA3AF' }}>
                    {tx.days[date.getDay()]}
                  </p>
                  <p
                    className="text-[16px] font-black mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto"
                    style={isToday ? { background: '#C41E3A', color: '#fff' } : { color: '#111111' }}
                  >
                    {date.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* 24h grid — every future cell clickable */}
          <div ref={gridRef} className="overflow-auto" style={{ maxHeight: '480px' }}>
            {ALL_HOURS.map(hour => (
              <div
                key={hour}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px repeat(7, 1fr)',
                  borderBottom: '1px solid #F3F4F6',
                  minHeight: `${ROW_HEIGHT}px`,
                }}
              >
                <div className="flex items-center justify-end pr-3">
                  <span className="text-[9px] font-medium" style={{ color: '#D1D5DB' }}>{hourLabel(hour)}</span>
                </div>

                {weekDates.map((date, colIdx) => {
                  const cellDate = new Date(date)
                  cellDate.setHours(hour, 0, 0, 0)
                  const cellKey = `${date.toDateString()}-${hour}`
                  const isBooked = bookedSet.has(cellKey)
                  const now = Date.now()
                  const minMs = now + 24 * 60 * 60 * 1000
                  const isPast = cellDate.getTime() <= now
                  const isTooSoon = cellDate.getTime() > now && cellDate.getTime() < minMs
                  const isUnavailable = isPast || isTooSoon
                  const scheduledAt = cellDate.toISOString()
                  const isSelected = !!(selected && selected.scheduledAt === scheduledAt)

                  return (
                    <div key={colIdx} className="p-1" style={{ borderLeft: '1px solid #F3F4F6' }}>
                      {isBooked ? (
                        <div
                          className="w-full rounded flex items-center justify-center gap-1 text-[9px] font-medium"
                          style={{ height: `${ROW_HEIGHT - 8}px`, background: '#F3F4F6', color: '#9CA3AF' }}
                        >
                          <Lock className="h-2.5 w-2.5" />
                          {tx.booked}
                        </div>
                      ) : isUnavailable ? (
                        <div
                          className="w-full rounded flex flex-col items-center justify-center text-[8px]"
                          style={{ height: `${ROW_HEIGHT - 8}px`, background: '#F9FAFB', color: '#D1D5DB', cursor: 'not-allowed' }}
                        >
                          {isTooSoon && <Clock className="h-2.5 w-2.5 mb-0.5" />}
                          {isTooSoon ? tx.tooSoon : ''}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelected({ date: cellDate, hour, scheduledAt }); setError('') }}
                          className="w-full rounded flex flex-col items-center justify-center text-[8px] font-bold transition-all"
                          style={{
                            height: `${ROW_HEIGHT - 8}px`,
                            ...(isSelected
                              ? { background: '#111111', color: '#F9F9F9' }
                              : { background: 'rgba(196,30,58,0.06)', cursor: 'pointer', color: '#C41E3A' })
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(196,30,58,0.12)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(196,30,58,0.06)' }}
                        >
                          <span>{hourLabel(hour)}</span>
                          <span className="text-[7px] font-normal opacity-70">{tx.available}</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
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
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
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

              <div className="px-6 py-4 space-y-3">
                {[
                  [tx.confirmDate, selected.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })],
                  [tx.confirmTime, hourLabel(selected.hour)],
                  [tx.confirmDuration, tx.confirmDurationVal],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}
                <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857' }}>
                  {tx.anyTimeNote}
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-3 rounded p-3 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
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
