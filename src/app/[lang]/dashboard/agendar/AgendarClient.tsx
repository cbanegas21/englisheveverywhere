'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { createBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { getZonedParts, zonedWallTimeToUtc } from '@/lib/timezone'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import Modal from '@/components/dashboard/Modal'

interface Props {
  lang: Locale
  studentId: string
  classesRemaining: number
  existingBookings: string[]
  /** Canonical display zone (profiles.timezone) — the grid is built in this zone. */
  timezone: string
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
      'Pick any 60-minute slot, 24h ahead.',
      'We assign an available teacher to your class.',
      "You'll get a confirmation email with the link.",
    ],
    prevWeek: '‹ Previous week',
    nextWeek: 'Next week ›',
    weekHint: 'Min. 24h advance notice',
    infoBanner: 'Each class is 60 minutes. You pick the time — we assign an available teacher to your booking.',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    booked: '—',
    libre: 'free',
    selected: 'Chosen',
    showBusinessHours: 'Show 6 AM – 9 PM',
    showAllHours: 'Show all 24 hours',
    classesPillLabel: (n: number) => `${n === 1 ? 'class' : 'classes'} in balance`,
    confirmKicker: 'Review',
    confirmTitle: 'Confirm booking',
    confirmSub: 'Review and confirm your class.',
    confirmDate: 'Date',
    confirmTime: 'Time',
    confirmDuration: 'Duration',
    confirmDurationVal: '60 min',
    confirm: 'Confirm booking',
    cancel: 'Cancel',
    booking: 'Booking…',
    successKicker: 'Confirmed',
    successTitle: 'Booked!',
    successSub: "We'll assign an available teacher to your class shortly — you'll get a confirmation email.",
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
      'Elige cualquier horario de 60 minutos, con 24h de anticipación.',
      'Asignamos un maestro disponible a tu clase.',
      'Recibes un correo de confirmación con el enlace.',
    ],
    prevWeek: '‹ Semana anterior',
    nextWeek: 'Semana siguiente ›',
    weekHint: 'Mín. 24h de anticipación',
    infoBanner: 'Cada clase dura 60 minutos. Tú eliges la hora — asignamos un maestro disponible a tu reserva.',
    days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    booked: '—',
    libre: 'libre',
    selected: 'Elegida',
    showBusinessHours: 'Mostrar 6 AM – 9 PM',
    showAllHours: 'Mostrar 24 horas',
    classesPillLabel: (n: number) => `clase${n === 1 ? '' : 's'} en saldo`,
    confirmKicker: 'Revisa',
    confirmTitle: 'Confirmar reserva',
    confirmSub: 'Revisa y confirma tu clase.',
    confirmDate: 'Fecha',
    confirmTime: 'Hora',
    confirmDuration: 'Duración',
    confirmDurationVal: '60 min',
    confirm: 'Confirmar reserva',
    cancel: 'Cancelar',
    booking: 'Reservando…',
    successKicker: 'Confirmada',
    successTitle: '¡Reservada!',
    successSub: 'Asignaremos un maestro disponible a tu clase muy pronto — recibirás un correo de confirmación.',
    viewClasses: 'Ver mis clases',
    bookAnother: 'Agendar otra',
    prepNext: '¿Quieres prepararte? Enviamos recordatorios 24h y 1h antes.',
  },
}

// A calendar day expressed in the student's profile zone (month 0-indexed). The
// whole grid is built from these so day boundaries + slot hours match the zone the
// rest of the app displays in, not the browser's local zone (DASH-04).
interface ZonedDay { year: number; month: number; day: number }

// Calendar arithmetic via Date.UTC — UTC has no DST, so rolling days/weekdays off a
// wall-clock y/m/d is exact (the conversion to an actual instant happens later, in
// zonedWallTimeToUtc, which IS DST-aware).
function addDays(d: ZonedDay, n: number): ZonedDay {
  const dt = new Date(Date.UTC(d.year, d.month, d.day + n))
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth(), day: dt.getUTCDate() }
}
function weekdayOf(d: ZonedDay): number {
  return new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()
}
function sameDay(a: ZonedDay, b: ZonedDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}
function todayInZone(tz: string): ZonedDay {
  const p = getZonedParts(new Date(), tz)
  return { year: p.year, month: p.month, day: p.day }
}
function getWeekDays(weekOffset: number, tz: string): ZonedDay[] {
  // Rolling 7-day window that ALWAYS starts on today (offset 0): opening the
  // scheduler on a Friday shows Fri → next Thu, instead of a fixed Sun–Sat grid
  // whose already-past days (Sun–Thu) render as a blank, unusable column.
  const today = todayInZone(tz)
  const start = addDays(today, weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
// Format the calendar day itself: build it as UTC noon and read back in UTC so the
// rendered weekday/month/day equals the ZonedDay exactly (no second tz shift).
function formatZonedDay(day: ZonedDay, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(Date.UTC(day.year, day.month, day.day, 12)).toLocaleDateString(locale, {
    ...opts,
    timeZone: 'UTC',
  })
}

function hourLabel(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

interface SelectedCell {
  /** Profile-zone wall-clock hour (0-23) of the slot. */
  hour: number
  /** Absolute instant (UTC ISO) the slot maps to. */
  scheduledAt: string
}

interface LastWeekSuggestion {
  hour: number
  scheduledAt: string
  displayDate: string
}

export default function AgendarClient({ lang, classesRemaining, existingBookings, timezone }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedCell | null>(null)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<SelectedCell | null>(null)
  const [showAllHours, setShowAllHours] = useState(false)

  const weekDays = useMemo(() => getWeekDays(weekOffset, timezone), [weekOffset, timezone])
  const todayDay = useMemo(() => todayInZone(timezone), [timezone, weekOffset])
  const visibleHours = showAllHours ? ALL_HOURS : BUSINESS_HOURS

  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (gridRef.current && showAllHours) {
      gridRef.current.scrollTop = 6 * 38 // approx scroll to 6 AM
    }
  }, [weekOffset, showAllHours])

  // Key occupied slots by their profile-zone calendar day + hour so they line up
  // with the grid cells (which are also keyed in the profile zone).
  const bookedSet = useMemo(() => {
    const set = new Set<string>()
    for (const iso of existingBookings) {
      const p = getZonedParts(new Date(iso), timezone)
      set.add(`${p.year}-${p.month}-${p.day}-${p.hour}`)
    }
    return set
  }, [existingBookings, timezone])

  const [nowSnapshotMs] = useState(() => Date.now())

  const lastWeekSuggestions = useMemo<LastWeekSuggestion[]>(() => {
    const weekAgo = nowSnapshotMs - 7 * 24 * 60 * 60 * 1000
    const minBookable = nowSnapshotMs + 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    const suggestions: LastWeekSuggestion[] = []
    for (const iso of existingBookings) {
      const instant = new Date(iso)
      const ms = instant.getTime()
      if (ms < weekAgo || ms >= nowSnapshotMs) continue
      // Same profile-zone wall-clock slot, one week later.
      const p = getZonedParts(instant, timezone)
      const nextDay = addDays({ year: p.year, month: p.month, day: p.day }, 7)
      const nextInstant = zonedWallTimeToUtc(nextDay.year, nextDay.month, nextDay.day, p.hour, 0, timezone)
      if (nextInstant.getTime() < minBookable) continue
      const key = `${nextDay.year}-${nextDay.month}-${nextDay.day}-${p.hour}`
      if (seen.has(key) || bookedSet.has(key)) continue
      seen.add(key)
      suggestions.push({
        hour: p.hour,
        scheduledAt: nextInstant.toISOString(),
        displayDate: nextInstant.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: timezone,
        }),
      })
    }
    return suggestions.slice(0, 3)
  }, [existingBookings, bookedSet, lang, nowSnapshotMs, timezone])

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
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            <div
              style={{
                padding: '38px 30px 34px',
                background: 'var(--ek-ink)',
                color: 'var(--ek-on-dark)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--ek-on-dark-muted)',
                  marginBottom: 14,
                }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--ek-red-light)' }} />
                {tx.successKicker}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                }}
              >
                {tx.successTitle}
              </h2>
              <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: 'var(--ek-on-dark-soft)' }}>
                {tx.successSub}
              </p>
            </div>
            <div style={{ padding: '24px 30px 26px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                [
                  tx.confirmDate,
                  new Date(booked.scheduledAt).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    timeZone: timezone,
                  }),
                ],
                [tx.confirmTime, hourLabel(booked.hour)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    padding: '11px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--ek-border-soft)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ek-text-muted)',
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--ek-text)', textTransform: 'capitalize' }}>
                    {value}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: 12, paddingTop: 14, lineHeight: 1.5, color: 'var(--ek-text-soft)' }}>
                {tx.prepNext}
              </p>
              <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
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
      <style>{`
        .lk-agendar-repeat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid var(--ek-border-soft);
          background: var(--ek-card);
          margin-bottom: 8px;
          cursor: pointer;
          text-align: left;
          font-family: var(--ek-font-sans);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .lk-agendar-repeat:hover {
          border-color: var(--ek-red);
          background: var(--ek-red-tint);
        }
        .lk-agendar-slot {
          width: 100%;
          height: 44px;
          background: var(--ek-red-tint);
          color: var(--ek-red);
          border-radius: 4px;
          border: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: var(--ek-font-sans);
        }
        .lk-agendar-slot:hover {
          background: var(--ek-red-tint-2);
        }
        .lk-agendar-cell {
          height: 44px;
        }
        @media (min-width: 640px) {
          .lk-agendar-slot {
            height: 38px;
            font-size: 10px;
          }
          .lk-agendar-cell {
            height: 38px;
          }
        }
      `}</style>
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
              alignItems: 'baseline',
              gap: 7,
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 12,
              letterSpacing: '0.03em',
              color: 'var(--ek-text-muted)',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>
              {classesRemaining}
            </span>
            {tx.classesPillLabel(classesRemaining)}
          </span>
        }
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"
        style={{
          padding: '28px clamp(16px, 4vw, 36px)',
          maxWidth: 1280,
          margin: '0 auto',
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
                  className="lk-agendar-repeat"
                  onClick={() => selectSlot({ hour: s.hour, scheduledAt: s.scheduledAt })}
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
                  gap: 12,
                  alignItems: 'stretch',
                  marginBottom: i === tx.how.length - 1 ? 0 : 14,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 3,
                    alignSelf: 'stretch',
                    background: 'var(--ek-red)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--ek-red)',
                      fontFeatureSettings: '"tnum"',
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--ek-text-soft)', lineHeight: 1.45 }}>{s}</span>
                </div>
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
                {formatZonedDay(weekDays[0], lang === 'es' ? 'es-HN' : 'en-US', {
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
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              paddingLeft: 14,
              borderLeft: '3px solid var(--ek-red)',
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--ek-text-soft)',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--ek-red)' }}>
              i
            </span>
            {tx.infoBanner}
          </div>

          {/* Hours-range toggle — surfaced ABOVE the grid (not only at the
              bottom) so early-morning slots are reachable without scrolling
              past the whole calendar first. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={() => setShowAllHours((v) => !v)}
              className="ek-chip-toggle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${showAllHours ? 'var(--ek-red-tint-3)' : 'var(--ek-border-mid)'}`,
                background: showAllHours ? 'var(--ek-red-tint)' : 'var(--ek-card)',
                color: showAllHours ? 'var(--ek-red)' : 'var(--ek-text-soft)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              <Clock className="h-3.5 w-3.5" />
              {showAllHours ? tx.showBusinessHours : tx.showAllHours}
            </button>
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
            {/* Horizontal scroller — keeps each day column usable on phones */}
            <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 'max(100%, 420px)' }}>
            {/* Day headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '48px repeat(7, minmax(46px, 1fr))',
                background: 'var(--ek-paper)',
                borderBottom: '1px solid var(--ek-border-soft)',
              }}
            >
              <div />
              {weekDays.map((day, i) => {
                const isToday = sameDay(day, todayDay)
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
                      {tx.days[weekdayOf(day)]}
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
                        color: isToday ? 'var(--ek-on-dark)' : 'var(--ek-text)',
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {day.day}
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
                    gridTemplateColumns: '48px repeat(7, minmax(46px, 1fr))',
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
                  {weekDays.map((day, colIdx) => {
                    // Resolve this profile-zone wall-clock slot to its absolute instant.
                    const cellInstant = zonedWallTimeToUtc(day.year, day.month, day.day, hour, 0, timezone)
                    const cellMs = cellInstant.getTime()
                    const cellKey = `${day.year}-${day.month}-${day.day}-${hour}`
                    const isBooked = bookedSet.has(cellKey)
                    const now = Date.now()
                    const minMs = now + 24 * 60 * 60 * 1000
                    const isPast = cellMs <= now
                    const isTooSoon = cellMs > now && cellMs < minMs
                    const isUnavailable = isPast || isTooSoon
                    const scheduledAt = cellInstant.toISOString()
                    const isSelected = !!(selected && selected.scheduledAt === scheduledAt)

                    return (
                      <div
                        key={colIdx}
                        style={{ padding: 4, borderLeft: '1px solid var(--ek-paper)' }}
                      >
                        {isBooked ? (
                          <div
                            className="lk-agendar-cell"
                            style={{
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
                            className="lk-agendar-cell"
                            style={{
                              background: 'var(--ek-paper)',
                              borderRadius: 4,
                              cursor: 'not-allowed',
                            }}
                          />
                        ) : isSelected ? (
                          <button
                            onClick={() => selectSlot({ hour, scheduledAt })}
                            className="lk-agendar-cell"
                            style={{
                              width: '100%',
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
                            className="lk-agendar-slot"
                            onClick={() => selectSlot({ hour, scheduledAt })}
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
            </div>
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
      <Modal
        open={!!selected}
        onClose={() => { if (!isPending) setSelected(null) }}
        kicker={tx.confirmKicker}
        title={tx.confirmTitle}
        maxWidth={440}
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { if (!isPending) setSelected(null) }}
              disabled={isPending}
              className="ek-btn ek-btn-ghost ek-btn-square"
              style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
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
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ek-text-soft)' }}>
              {tx.confirmSub}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                [
                  tx.confirmDate,
                  new Date(selected.scheduledAt).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    timeZone: timezone,
                  }),
                ],
                [tx.confirmTime, hourLabel(selected.hour)],
                [tx.confirmDuration, tx.confirmDurationVal],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    padding: '11px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--ek-border-soft)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ek-text-muted)',
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--ek-text)', textTransform: 'capitalize' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                paddingLeft: 14,
                borderLeft: '3px solid var(--ek-success-border)',
                fontSize: 12,
                lineHeight: 1.55,
                color: 'var(--ek-success-text)',
              }}
            >
              {tx.infoBanner}
            </div>
            {error && (
              <div
                style={{
                  paddingLeft: 14,
                  borderLeft: '3px solid var(--ek-red)',
                  fontSize: 12,
                  lineHeight: 1.5,
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
