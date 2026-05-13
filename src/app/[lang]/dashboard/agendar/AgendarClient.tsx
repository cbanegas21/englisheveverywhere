'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'

interface Props {
  lang: Locale
  studentId: string
  classesRemaining: number
  existingBookings: string[]
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const BUSINESS_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

const t = {
  en: {
    title: 'Schedule',
    flourish: 'whenever you want',
    sub: 'Pick a 60-minute slot at least 24h ahead · times in your local zone',
    saldoKicker: 'Available balance',
    saldoSub: (n: number) => `${n} ${n === 1 ? 'class' : 'classes'} · never expire${n === 1 ? 's' : ''}`,
    repeatKicker: 'Repeat last week',
    repeatEmpty: 'Classes you take this week will appear here next time.',
    howKicker: 'How it works',
    how: [
      'Pick a 60-minute slot.',
      'We assign a teacher within 24h.',
      "You'll get a confirmation email.",
    ],
    prevWeek: '‹ Previous week',
    nextWeek: 'Next week ›',
    weekHint: 'Min. 24h advance notice',
    infoBanner: 'Each class is 60 minutes. We assign your teacher within 24 hours of booking.',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    booked: '—',
    libre: 'free',
    selected: 'Chosen',
    showBusinessHours: 'Show 6 AM – 9 PM',
    showAllHours: 'Show all 24 hours',
    classesPill: (n: number) => `${n} ${n === 1 ? 'class' : 'classes'} in your balance`,
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
    prepNext: 'Want to prep? We email reminders 24h and 1h before class.',
  },
  es: {
    title: 'Agenda',
    flourish: 'cuando quieras',
    sub: 'Elige un horario de 60 min con al menos 24h de anticipación · horas en tu zona local',
    saldoKicker: 'Saldo disponible',
    saldoSub: (n: number) => `${n} clase${n === 1 ? '' : 's'} · no expira${n === 1 ? '' : 'n'}`,
    repeatKicker: 'Repetir semana pasada',
    repeatEmpty: 'Las clases que tomes esta semana aparecerán aquí la próxima vez.',
    howKicker: 'Cómo funciona',
    how: [
      'Elige un horario de 60 minutos.',
      'Asignamos maestro en menos de 24h.',
      'Recibes confirmación por correo.',
    ],
    prevWeek: '‹ Semana anterior',
    nextWeek: 'Semana siguiente ›',
    weekHint: 'Mín. 24h de anticipación',
    infoBanner: 'Cada clase dura 60 minutos. Te asignamos maestro dentro de las 24h posteriores a tu reserva.',
    days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    booked: '—',
    libre: 'libre',
    selected: 'Elegida',
    showBusinessHours: 'Mostrar 6 AM – 9 PM',
    showAllHours: 'Mostrar 24 horas',
    classesPill: (n: number) => `${n} clase${n === 1 ? '' : 's'} en tu saldo`,
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
    prepNext: '¿Quieres prepararte? Enviamos recordatorios 24h y 1h antes.',
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
      gridRef.current.scrollTop = 6 * 38 // approx scroll to 6 AM
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
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar
          title={
            <span>
              {tx.title} <TitleFlourish>{tx.flourish}</TitleFlourish>
            </span>
          }
          sub={tx.sub}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            minHeight: '60vh',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              textAlign: 'center',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            <div
              style={{
                padding: '40px 24px',
                background: 'var(--ek-ink)',
                color: 'var(--ek-on-dark)',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                }}
              >
                {tx.successTitle}
              </h2>
              <p style={{ marginTop: 6, fontSize: 14, color: 'var(--ek-on-dark-soft)' }}>{tx.successSub}</p>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                [
                  tx.confirmDate,
                  booked.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  }),
                ],
                [tx.confirmTime, hourLabel(booked.hour)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--ek-text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--ek-text)' }}>{value}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, paddingTop: 6, color: 'var(--ek-text-soft)' }}>{tx.prepNext}</p>
              <div style={{ display: 'flex', gap: 10, paddingTop: 10 }}>
                <button
                  onClick={() => setBooked(null)}
                  className="ek-btn ek-btn-ghost ek-btn-square"
                  style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
                >
                  {tx.bookAnother}
                </button>
                <button
                  onClick={() => router.push(`/${lang}/dashboard/clases`)}
                  className="ek-btn ek-btn-red ek-btn-square"
                  style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
                >
                  {tx.viewClasses} →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar
        title={
          <span>
            {tx.title} <TitleFlourish>{tx.flourish}</TitleFlourish>
          </span>
        }
        sub={tx.sub}
        right={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'var(--ek-red-tint)',
              border: '1px solid var(--ek-red-tint-3)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ek-red)' }}>
              {tx.classesPill(classesRemaining)}
            </span>
          </span>
        }
      />

      <div
        style={{
          padding: '28px 36px',
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
          gap: 24,
        }}
      >
        {/* LEFT RAIL */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Balance dark hero */}
          <DarkHeroCard
            ghost={classesRemaining}
            ghostSize={180}
            ghostStyle={{ top: -30, right: -16 }}
            padding="22px 22px 24px"
            radius={14}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-on-dark-muted)',
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {tx.saldoKicker}
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: '-0.035em',
                lineHeight: 1,
                color: 'var(--ek-on-dark)',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {classesRemaining}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ek-on-dark-soft)', marginTop: 6 }}>
              {tx.saldoSub(classesRemaining)}
            </div>
          </DarkHeroCard>

          {/* Repeat last week */}
          <div
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {tx.repeatKicker}
            </div>
            {lastWeekSuggestions.length > 0 ? (
              lastWeekSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() =>
                    selectSlot({ date: s.nextDate, hour: s.hour, scheduledAt: s.scheduledAt })
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--ek-border-soft)',
                    background: 'var(--ek-card)',
                    marginBottom: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--ek-red)'
                    e.currentTarget.style.background = 'var(--ek-red-tint)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--ek-border-soft)'
                    e.currentTarget.style.background = 'var(--ek-card)'
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--ek-text)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {s.displayDate}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ek-text-muted)',
                        marginTop: 1,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {hourLabel(s.hour)}
                    </div>
                  </div>
                  <span style={{ color: 'var(--ek-red)', fontSize: 14 }}>↻</span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>
                {tx.repeatEmpty}
              </div>
            )}
          </div>

          {/* How it works */}
          <div
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {tx.howKicker}
            </div>
            {tx.how.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--ek-red-tint-2)',
                    color: 'var(--ek-red)',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ek-text-soft)', lineHeight: 1.45 }}>{s}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN GRID */}
        <main style={{ minWidth: 0 }}>
          {/* Week nav */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: 12,
            }}
          >
            <button
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={weekOffset <= 0}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border-mid)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ek-text-soft)',
                cursor: weekOffset <= 0 ? 'default' : 'pointer',
                opacity: weekOffset <= 0 ? 0.4 : 1,
                fontFamily: 'var(--ek-font-sans)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{tx.prevWeek.replace('‹ ', '')}</span>
            </button>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--ek-text)',
                  letterSpacing: '-0.02em',
                  textTransform: 'capitalize',
                }}
              >
                {weekDates[0].toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ek-text-muted)', marginTop: 2 }}>
                {tx.weekHint}
              </div>
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border-mid)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ek-text-soft)',
                cursor: 'pointer',
                fontFamily: 'var(--ek-font-sans)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="hidden sm:inline">{tx.nextWeek.replace(' ›', '')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Hint banner */}
          <div
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-success-border)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              fontSize: 12.5,
              color: 'var(--ek-success-text)',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 18 }}>
              i
            </span>
            {tx.infoBanner}
          </div>

          {/* Calendar */}
          <div
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              overflow: 'hidden',
            }}
          >
            {/* Day headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px repeat(7, 1fr)',
                background: 'var(--ek-paper)',
                borderBottom: '1px solid var(--ek-border-soft)',
              }}
            >
              <div />
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <div key={i} style={{ padding: '12px 0', textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: isToday ? 'var(--ek-red)' : 'var(--ek-text-muted)',
                        fontFamily: 'var(--ek-font-mono)',
                      }}
                    >
                      {tx.days[date.getDay()]}
                    </div>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        lineHeight: '30px',
                        borderRadius: '50%',
                        margin: '4px auto 0',
                        fontSize: 15,
                        fontWeight: 800,
                        background: isToday ? 'var(--ek-red)' : 'transparent',
                        color: isToday ? '#fff' : 'var(--ek-text)',
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grid body */}
            <div ref={gridRef} style={{ overflow: 'auto', maxHeight: 640 }}>
              {visibleHours.map((hour) => (
                <div
                  key={hour}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px repeat(7, 1fr)',
                    borderBottom: '1px solid var(--ek-paper)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 12,
                      fontSize: 10.5,
                      color: 'var(--ek-text-muted)',
                      fontFeatureSettings: '"tnum"',
                      fontFamily: 'var(--ek-font-mono)',
                    }}
                  >
                    {hourLabel(hour)}
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
                      <div
                        key={colIdx}
                        style={{ padding: 4, borderLeft: '1px solid var(--ek-paper)' }}
                      >
                        {isBooked ? (
                          <div
                            style={{
                              height: 38,
                              background: 'var(--ek-paper-deep)',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--ek-text-faint)',
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {tx.booked}
                          </div>
                        ) : isUnavailable ? (
                          <div
                            style={{
                              height: 38,
                              background: 'var(--ek-paper)',
                              borderRadius: 4,
                              cursor: 'not-allowed',
                            }}
                          />
                        ) : isSelected ? (
                          <button
                            onClick={() => selectSlot({ date: cellDate, hour, scheduledAt })}
                            style={{
                              width: '100%',
                              height: 38,
                              background: 'var(--ek-ink)',
                              color: 'var(--ek-on-dark)',
                              borderRadius: 4,
                              border: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              boxShadow: '0 2px 10px rgba(17,17,17,0.25)',
                              cursor: 'pointer',
                              fontFamily: 'var(--ek-font-sans)',
                            }}
                          >
                            {tx.selected}
                          </button>
                        ) : (
                          <button
                            onClick={() => selectSlot({ date: cellDate, hour, scheduledAt })}
                            style={{
                              width: '100%',
                              height: 38,
                              background: 'var(--ek-red-tint)',
                              color: 'var(--ek-red)',
                              borderRadius: 4,
                              border: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                              fontFamily: 'var(--ek-font-sans)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--ek-red-tint-2)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--ek-red-tint)'
                            }}
                          >
                            {tx.libre}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Toggle hours */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '12px 16px',
                borderTop: '1px solid var(--ek-border-soft)',
                background: 'var(--ek-paper)',
              }}
            >
              <button
                onClick={() => setShowAllHours((v) => !v)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ek-red)',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--ek-font-sans)',
                  letterSpacing: '0.04em',
                }}
              >
                {showAllHours ? tx.showBusinessHours : tx.showAllHours}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Confirm booking modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isPending && setSelected(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(17,17,17,0.5)',
                backdropFilter: 'blur(4px)',
                zIndex: 40,
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100% - 2rem)',
                maxWidth: 440,
                background: 'var(--ek-card)',
                borderRadius: 16,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                zIndex: 50,
                overflow: 'hidden',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--ek-border)',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      color: 'var(--ek-text)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {tx.confirmTitle}
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      color: 'var(--ek-text-muted)',
                    }}
                  >
                    {tx.confirmSub}
                  </p>
                </div>
                <button
                  onClick={() => !isPending && setSelected(null)}
                  disabled={isPending}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--ek-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  [
                    tx.confirmDate,
                    selected.date.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    }),
                  ],
                  [tx.confirmTime, hourLabel(selected.hour)],
                  [tx.confirmDuration, tx.confirmDurationVal],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--ek-text-muted)' }}>{label}</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--ek-text)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    background: 'var(--ek-success-bg)',
                    border: '1px solid var(--ek-success-border)',
                    color: 'var(--ek-success-text)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {tx.infoBanner}
                </div>
              </div>

              {error && (
                <div
                  style={{
                    margin: '0 24px 12px',
                    padding: 12,
                    fontSize: 12,
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, padding: '0 24px 24px' }}>
                <button
                  onClick={() => !isPending && setSelected(null)}
                  disabled={isPending}
                  className="ek-btn ek-btn-ghost ek-btn-square"
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    fontSize: 13,
                    justifyContent: 'center',
                  }}
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="ek-btn ek-btn-red ek-btn-square"
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    fontSize: 13,
                    justifyContent: 'center',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? tx.booking : tx.confirm}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
