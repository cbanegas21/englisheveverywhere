'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, ArrowRight, X, Calendar, Clock, ChevronLeft, ChevronRight,
  Lock, RotateCcw, Sparkles, Info,
} from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  lang: Locale
  studentId: string
  classesRemaining: number
  existingBookings: string[]
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const BUSINESS_HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7 AM to 10 PM
const ROW_HEIGHT = 52

const t = {
  en: {
    title: 'Schedule a Class',
    subtitle: 'Pick any time that works for you. All classes are 60 minutes.',
    classesLeft: (n: number) => `${n} class${n !== 1 ? 'es' : ''} left`,
    availableBalance: 'Available balance',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    available: 'Available',
    confirmTitle: 'Confirm booking',
    confirmSub: 'Review and confirm your class.',
    confirmDate: 'Date',
    confirmTime: 'Time',
    confirmDuration: 'Duration',
    confirmDurationVal: '60 min',
    confirm: 'Confirm booking',
    cancel: 'Cancel',
    booking: 'Booking…',
    successTitle: 'Booked!',
    successSub: 'Your teacher will be assigned within 24 hours.',
    viewClasses: 'View my classes',
    bookAnother: 'Book another',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notice24h: '24h advance notice required',
    booked: 'Booked',
    tooSoon: 'Too soon',
    anyTimeNote: 'Book any time — a teacher is assigned after the booking.',
    repeatTitle: 'Repeat last week',
    repeatSub: 'Book the same slots you used in the last 7 days.',
    repeatEmpty: 'Classes you took this past week will show up here next time.',
    showBusinessHours: 'Show 7 AM – 10 PM',
    showAllHours: 'Show all 24 hours',
    tipsTitle: 'How it works',
    tip1: 'Pick a 60-minute slot — at least 24 hours in advance.',
    tip2: "We assign your teacher within 24 hours of booking.",
    tip3: "You'll get a confirmation email and can join from My Classes.",
    legendAvailable: 'Available',
    legendBooked: 'Already booked',
    legendTooSoon: 'Too soon',
    successPanelTitle: 'All set!',
    prepNext: 'Want to prep? We email reminders 24h and 1h before class.',
    nothingToRepeat: 'Nothing to repeat yet',
  },
  es: {
    title: 'Agendar Clase',
    subtitle: 'Elige cualquier horario que funcione para ti. Todas las clases son de 60 minutos.',
    classesLeft: (n: number) => `${n} clase${n !== 1 ? 's' : ''} disponible${n !== 1 ? 's' : ''}`,
    availableBalance: 'Balance disponible',
    prevWeek: 'Semana anterior',
    nextWeek: 'Semana siguiente',
    available: 'Disponible',
    confirmTitle: 'Confirmar reserva',
    confirmSub: 'Revisa y confirma tu clase.',
    confirmDate: 'Fecha',
    confirmTime: 'Hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '60 min',
    confirm: 'Confirmar reserva',
    cancel: 'Cancelar',
    booking: 'Reservando…',
    successTitle: '¡Reservada!',
    successSub: 'Te asignaremos un maestro en las próximas 24 horas.',
    viewClasses: 'Ver mis clases',
    bookAnother: 'Agendar otra',
    days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    notice24h: 'Requiere 24h de anticipación',
    booked: 'Ocupada',
    tooSoon: 'Muy pronto',
    anyTimeNote: 'Agenda a cualquier hora — asignamos maestro después de reservar.',
    repeatTitle: 'Repetir semana pasada',
    repeatSub: 'Reserva los mismos horarios que usaste en los últimos 7 días.',
    repeatEmpty: 'Las clases que tomes esta semana aparecerán aquí la próxima vez.',
    showBusinessHours: 'Mostrar 7 AM – 10 PM',
    showAllHours: 'Mostrar 24 horas',
    tipsTitle: 'Cómo funciona',
    tip1: 'Elige un horario de 60 minutos — con al menos 24h de anticipación.',
    tip2: 'Te asignamos maestro dentro de 24 horas de la reserva.',
    tip3: 'Recibes un correo de confirmación y puedes unirte desde Mis Clases.',
    legendAvailable: 'Disponible',
    legendBooked: 'Ocupada',
    legendTooSoon: 'Muy pronto',
    successPanelTitle: '¡Todo listo!',
    prepNext: '¿Quieres prepararte? Enviamos recordatorios 24h y 1h antes.',
    nothingToRepeat: 'Nada para repetir aún',
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

interface LastWeekSuggestion {
  nextDate: Date
  hour: number
  scheduledAt: string
  displayDate: string
}

export default function AgendarClient({ lang, classesRemaining, existingBookings }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedCell | null>(null)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<SelectedCell | null>(null)
  const [showAllHours, setShowAllHours] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const visibleHours = showAllHours ? ALL_HOURS : BUSINESS_HOURS

  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (gridRef.current && showAllHours) {
      gridRef.current.scrollTop = 8 * ROW_HEIGHT // scroll to 8 AM
    }
  }, [weekOffset, showAllHours])

  const bookedSet = useMemo(() => {
    const set = new Set<string>()
    for (const iso of existingBookings) {
      const d = new Date(iso)
      set.add(`${d.toDateString()}-${d.getHours()}`)
    }
    return set
  }, [existingBookings])

  const [nowSnapshotMs] = useState(() => Date.now())

  const lastWeekSuggestions = useMemo<LastWeekSuggestion[]>(() => {
    const weekAgo = nowSnapshotMs - 7 * 24 * 60 * 60 * 1000
    const minBookable = nowSnapshotMs + 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    const suggestions: LastWeekSuggestion[] = []
    for (const iso of existingBookings) {
      const d = new Date(iso)
      if (d.getTime() < weekAgo || d.getTime() >= nowSnapshotMs) continue
      const next = new Date(d)
      next.setDate(d.getDate() + 7)
      if (next.getTime() < minBookable) continue
      const key = `${next.toDateString()}-${next.getHours()}`
      if (seen.has(key) || bookedSet.has(key)) continue
      seen.add(key)
      suggestions.push({
        nextDate: next,
        hour: next.getHours(),
        scheduledAt: next.toISOString(),
        displayDate: next.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      })
    }
    return suggestions.slice(0, 3)
  }, [existingBookings, bookedSet, lang, nowSnapshotMs])

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

  function selectSlot(cell: SelectedCell) {
    setSelected(cell)
    setError('')
  }

  // ── Success screen ─────────────────────────────────────────────
  if (booked) {
    return (
      <div className="min-h-full flex flex-col" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-[460px] rounded-2xl overflow-hidden text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
          >
            <div className="py-10 px-6" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[24px] font-black text-white mb-1">{tx.successTitle}</h2>
              <p className="text-[14px] text-white/85">{tx.successSub}</p>
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
              <p className="text-[12px] pt-2" style={{ color: '#6B7280' }}>{tx.prepNext}</p>
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
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.15)' }}>
            <Calendar className="h-4 w-4" style={{ color: '#C41E3A' }} />
            <span className="text-[13px] font-semibold" style={{ color: '#C41E3A' }}>
              {tx.classesLeft(classesRemaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">

          {/* LEFT RAIL */}
          <aside className="space-y-4">
            {/* Balance hero card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #C41E3A, #8B1529)', boxShadow: '0 8px 30px rgba(196,30,58,0.15)' }}
            >
              <div className="p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-white/80" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">
                    {tx.availableBalance}
                  </p>
                </div>
                <p className="text-[44px] font-black leading-none mb-1 tabular-nums">{classesRemaining}</p>
                <p className="text-[12px] text-white/80">{tx.classesLeft(classesRemaining).replace(/^\d+\s/, '').replace(/^[^ ]+\s/, '')}</p>
              </div>
            </div>

            {/* Repeat last week */}
            <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(196,30,58,0.08)' }}>
                    <RotateCcw className="h-4 w-4" style={{ color: '#C41E3A' }} />
                  </div>
                  <h3 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.repeatTitle}</h3>
                </div>
                <p className="text-[12px] leading-relaxed mb-3" style={{ color: '#9CA3AF' }}>
                  {lastWeekSuggestions.length > 0 ? tx.repeatSub : tx.repeatEmpty}
                </p>
              </div>
              {lastWeekSuggestions.length > 0 ? (
                <div className="pb-4 px-4 space-y-1.5">
                  {lastWeekSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectSlot({ date: s.nextDate, hour: s.hour, scheduledAt: s.scheduledAt })}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-all"
                      style={{ border: '1px solid #E5E7EB', background: '#fff' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,30,58,0.04)'; e.currentTarget.style.borderColor = '#C41E3A' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                    >
                      <div>
                        <p className="text-[12px] font-semibold capitalize" style={{ color: '#111111' }}>{s.displayDate}</p>
                        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{hourLabel(s.hour)}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#C41E3A' }} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-5 pb-5">
                  <div className="rounded-lg py-3 px-3 text-center text-[11px]" style={{ background: '#F9F9F9', color: '#9CA3AF' }}>
                    {tx.nothingToRepeat}
                  </div>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
                  <Info className="h-4 w-4" style={{ color: '#3B82F6' }} />
                </div>
                <h3 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.tipsTitle}</h3>
              </div>
              <ol className="space-y-2.5">
                {[tx.tip1, tx.tip2, tx.tip3].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}>
                      {i + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* MAIN GRID */}
          <main className="min-w-0">
            {/* Week nav */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <button
                onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
                disabled={weekOffset <= 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-30"
                style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                onMouseEnter={e => { if (weekOffset > 0) e.currentTarget.style.background = '#F9F9F9' }}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{tx.prevWeek}</span>
              </button>
              <div className="text-center flex-1">
                <p className="text-[15px] font-black capitalize" style={{ color: '#111111' }}>
                  {weekDates[0].toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.notice24h}</p>
              </div>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
                style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <span className="hidden sm:inline">{tx.nextWeek}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Info banner */}
            <div
              className="mb-4 rounded-xl px-4 py-3 text-[12px] flex items-start gap-2.5"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857' }}
            >
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{tx.anyTimeNote}</span>
            </div>

            {/* Calendar card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              {/* Day headers */}
              <div className="grid" style={{ gridTemplateColumns: '68px repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <div />
                {weekDates.map((date, i) => {
                  const isToday = date.toDateString() === new Date().toDateString()
                  const isPastDay = date.getTime() < new Date().setHours(0, 0, 0, 0)
                  return (
                    <div key={i} className="py-3 text-center" style={{ opacity: isPastDay ? 0.35 : 1 }}>
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isToday ? '#C41E3A' : '#9CA3AF' }}>
                        {tx.days[date.getDay()]}
                      </p>
                      <p
                        className="text-[17px] font-black mt-1 w-9 h-9 flex items-center justify-center rounded-full mx-auto tabular-nums"
                        style={isToday ? { background: '#C41E3A', color: '#fff' } : { color: '#111111' }}
                      >
                        {date.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Grid body */}
              <div ref={gridRef} className="overflow-auto" style={{ maxHeight: '640px' }}>
                {visibleHours.map(hour => (
                  <div
                    key={hour}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '68px repeat(7, 1fr)',
                      borderBottom: '1px solid #F3F4F6',
                      minHeight: `${ROW_HEIGHT}px`,
                    }}
                  >
                    <div className="flex items-center justify-end pr-3">
                      <span className="text-[11px] font-medium tabular-nums" style={{ color: '#9CA3AF' }}>{hourLabel(hour)}</span>
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
                        <div key={colIdx} className="p-1.5" style={{ borderLeft: '1px solid #F3F4F6' }}>
                          {isBooked ? (
                            <div
                              className="w-full rounded-md flex items-center justify-center gap-1 text-[10px] font-semibold"
                              style={{ height: `${ROW_HEIGHT - 12}px`, background: '#F3F4F6', color: '#9CA3AF' }}
                            >
                              <Lock className="h-3 w-3" />
                              {tx.booked}
                            </div>
                          ) : isUnavailable ? (
                            <div
                              className="w-full rounded-md flex flex-col items-center justify-center text-[9px]"
                              style={{ height: `${ROW_HEIGHT - 12}px`, background: '#FAFAFA', color: '#D1D5DB', cursor: 'not-allowed' }}
                            >
                              {isTooSoon && (
                                <>
                                  <Clock className="h-3 w-3 mb-0.5" />
                                  <span className="font-medium">{tx.tooSoon}</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => selectSlot({ date: cellDate, hour, scheduledAt })}
                              className="w-full rounded-md flex flex-col items-center justify-center text-[11px] font-bold transition-all"
                              style={{
                                height: `${ROW_HEIGHT - 12}px`,
                                ...(isSelected
                                  ? { background: '#111111', color: '#F9F9F9', boxShadow: '0 2px 8px rgba(17,17,17,0.15)' }
                                  : { background: 'rgba(196,30,58,0.06)', cursor: 'pointer', color: '#C41E3A' })
                              }}
                              onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'rgba(196,30,58,0.14)'; e.currentTarget.style.transform = 'scale(1.02)' } }}
                              onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'rgba(196,30,58,0.06)'; e.currentTarget.style.transform = 'scale(1)' } }}
                            >
                              {hourLabel(hour)}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Show more/less hours toggle */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <div className="flex items-center gap-4 text-[11px]" style={{ color: '#6B7280' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded" style={{ background: 'rgba(196,30,58,0.6)' }} />
                    {tx.legendAvailable}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded" style={{ background: '#E5E7EB' }} />
                    {tx.legendBooked}
                  </span>
                </div>
                <button
                  onClick={() => setShowAllHours(v => !v)}
                  className="text-[11px] font-semibold transition-colors"
                  style={{ color: '#C41E3A' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#9E1830')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#C41E3A')}
                >
                  {showAllHours ? tx.showBusinessHours : tx.showAllHours}
                </button>
              </div>
            </div>
          </main>
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
              style={{ background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[420px] rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <h3 className="font-black text-[16px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                  <p className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.confirmSub}</p>
                </div>
                <button
                  onClick={() => !isPending && setSelected(null)}
                  disabled={isPending}
                  className="transition-colors disabled:opacity-40 flex-shrink-0"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-3">
                {[
                  [tx.confirmDate, selected.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })],
                  [tx.confirmTime, hourLabel(selected.hour)],
                  [tx.confirmDuration, tx.confirmDurationVal],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="font-semibold capitalize" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}
                <div className="rounded-lg px-3 py-2.5 text-[12px] leading-relaxed" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857' }}>
                  {tx.anyTimeNote}
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-3 rounded-lg p-3 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
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
