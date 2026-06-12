'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Video } from 'lucide-react'
import { confirmBooking, declineBooking, requestReschedule, cancelRescheduleRequest } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Modal from '@/components/dashboard/Modal'

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  type?: string | null
  student?: { profile?: { full_name?: string; avatar_url?: string } } | null
  reschedule_request?: {
    id: string
    proposed_scheduled_at: string
    status: string
  } | null
}

interface Props {
  lang: Locale
  timezone: string
  pendingBookings: Booking[]
  confirmedBookings: Booking[]
}

const t = {
  en: {
    title: 'My schedule',
    subtitle: 'Manage your incoming and upcoming sessions.',
    pending: 'Classes to confirm',
    noPending: 'No classes awaiting your confirmation.',
    pendingHint: 'These classes were assigned to you by the admin. Confirm the ones you can teach.',
    upcoming: 'Upcoming confirmed sessions',
    noUpcoming: 'No upcoming sessions.',
    confirm: "I can teach this",
    decline: "Can't make it",
    join: 'Join room',
    mins: 'min',
    with: 'Student:',
    today: 'Today',
    tomorrow: 'Tomorrow',
    statusConfirmed: 'Confirmed',
    typePlacement: 'Placement',
    typeCheckin: 'Check-in',
    typeClass: 'Class',
    pendingKicker: 'To confirm',
    confirmedKicker: 'Confirmed',
    reschedule: 'Request reschedule',
    reschedulePending: 'Reschedule pending',
    rescheduleCancel: 'Cancel request',
    rescheduleTitle: 'Request a reschedule',
    rescheduleKicker: 'Reschedule',
    rescheduleSubtitle: 'Admin will review your proposed time before the class moves.',
    rescheduleNewDate: 'New date',
    rescheduleNewTime: 'New time',
    rescheduleReason: 'Reason (optional)',
    reschedulePlaceholder: 'e.g. Power outage at my home — can we move 2 hours later?',
    rescheduleSubmit: 'Submit request',
    rescheduleCancelBtn: 'Cancel',
    rescheduleError: 'Could not submit request',
    rescheduleSuccess: 'Request submitted. Admin will review.',
  },
  es: {
    title: 'Mi agenda',
    subtitle: 'Gestiona tus clases asignadas y sesiones próximas.',
    pending: 'Clases por confirmar',
    noPending: 'No hay clases por confirmar.',
    pendingHint: 'El admin te asignó estas clases. Confirma las que puedas impartir.',
    upcoming: 'Sesiones confirmadas próximas',
    noUpcoming: 'Sin sesiones próximas.',
    confirm: 'Puedo impartirla',
    decline: 'No puedo',
    join: 'Entrar a sala',
    mins: 'min',
    with: 'Estudiante:',
    today: 'Hoy',
    tomorrow: 'Mañana',
    statusConfirmed: 'Confirmada',
    typePlacement: 'Nivelación',
    typeCheckin: 'Check-in',
    typeClass: 'Clase',
    pendingKicker: 'Por confirmar',
    confirmedKicker: 'Confirmadas',
    reschedule: 'Solicitar reagendar',
    reschedulePending: 'Reagendamiento pendiente',
    rescheduleCancel: 'Cancelar solicitud',
    rescheduleTitle: 'Solicitar reagendar',
    rescheduleKicker: 'Reagendar',
    rescheduleSubtitle: 'El admin revisará tu nueva hora antes de mover la clase.',
    rescheduleNewDate: 'Nueva fecha',
    rescheduleNewTime: 'Nueva hora',
    rescheduleReason: 'Motivo (opcional)',
    reschedulePlaceholder: 'Ej. Corte de luz en casa — ¿podemos mover 2 horas después?',
    rescheduleSubmit: 'Enviar solicitud',
    rescheduleCancelBtn: 'Cancelar',
    rescheduleError: 'No se pudo enviar la solicitud',
    rescheduleSuccess: 'Solicitud enviada. El admin la revisará.',
  },
}

function ymdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function formatDate(iso: string, lang: Locale, tx: typeof t['en'], timeZone: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (ymdInTz(d, timeZone) === ymdInTz(now, timeZone)) return tx.today
  if (ymdInTz(d, timeZone) === ymdInTz(tomorrow, timeZone)) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone,
  })
}

function formatTime(iso: string, lang: 'es' | 'en', timeZone: string) {
  // Pin the locale so SSR and client render identically — passing []
  // picks up the env locale, which differs between Node and browser and
  // causes hydration mismatches (e.g. "04:00 PM" vs "04:00 p.m.").
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', timeZone,
  })
}

// ── Timezone-aware wall-clock helpers ───────────────────────────────────
// The reschedule form's date/time inputs are wall-clock in the TEACHER's
// profile timezone (the same zone the session cards render in). These helpers
// read/write that wall-clock without a date library so the prefill matches the
// card and the submitted instant lands on the intended local time.

/** Wall-clock parts of an instant, as seen in `timeZone`. */
function wallClockInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  let hour = get('hour')
  if (hour === '24') hour = '00' // Intl can emit "24" for midnight
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  }
}

/** `timeZone`'s offset from UTC (ms) at the given instant. */
function tzOffsetMs(d: Date, timeZone: string): number {
  const w = wallClockInTz(d, timeZone)
  // Treat the wall-clock parts as if they were UTC, then diff against the
  // real instant — that difference IS the zone's offset at that moment.
  const asUtc = Date.UTC(
    Number(w.year), Number(w.month) - 1, Number(w.day),
    Number(w.hour), Number(w.minute), Number(w.second),
  )
  return asUtc - d.getTime()
}

/** Build the UTC instant for a wall-clock `YYYY-MM-DD` + `HH:mm` in `timeZone`. */
function wallClockToInstant(date: string, time: string, timeZone: string): Date {
  const [y, mo, da] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // First guess: interpret the wall-clock as UTC.
  const utcGuess = Date.UTC(y, (mo || 1) - 1, da || 1, hh || 0, mm || 0, 0)
  // Correct by the zone offset (sampled at the guess — good enough outside the
  // rare DST-transition hour, which doesn't apply to the fixed-offset zones
  // this app uses).
  const offset = tzOffsetMs(new Date(utcGuess), timeZone)
  return new Date(utcGuess - offset)
}

function getInitials(name?: string | null) {
  if (!name) return 'S'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// Zoom-style lobby makes pre-call entry possible at any time, so the "Join"
// button is available up to 24h before and 2h after the scheduled start.
function canEnterRoom(scheduledAt: string, durationMinutes: number) {
  const now = Date.now()
  const scheduled = new Date(scheduledAt).getTime()
  const openAt = scheduled - 24 * 60 * 60 * 1000
  const closeAt = scheduled + (durationMinutes + 90) * 60 * 1000
  return now >= openAt && now <= closeAt
}

function typeLabel(type: string | null | undefined, tx: { typePlacement: string; typeCheckin: string; typeClass: string }) {
  if (type === 'placement_test') return tx.typePlacement
  if (type === 'admin_checkin') return tx.typeCheckin
  return null
}

/** Crimson/ink hairline chip for the session type (Placement / Check-in). */
function TypeChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 4,
        background: 'var(--ek-red-tint)',
        color: 'var(--ek-red)',
        border: '1px solid var(--ek-red-tint-3)',
        fontFamily: 'var(--ek-font-mono)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function AgendaClient({ lang, timezone, pendingBookings, confirmedBookings }: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [pending, setPending] = useState<Booking[]>(pendingBookings)
  const [confirmed, setConfirmed] = useState<Booking[]>(confirmedBookings)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Reschedule modal state — nullable; when set, the modal is open for that booking.
  const [rescheduleFor, setRescheduleFor] = useState<Booking | null>(null)
  const [reschedDate, setReschedDate] = useState('')
  const [reschedTime, setReschedTime] = useState('')
  const [reschedReason, setReschedReason] = useState('')
  const [reschedError, setReschedError] = useState('')
  const [reschedSubmitting, setReschedSubmitting] = useState(false)
  // Surfaced when confirm/decline fails (e.g. the booking was concurrently
  // cancelled or rescheduled so it's no longer pending). Server returns a
  // localized message — show it instead of failing silently.
  const [actionError, setActionError] = useState('')

  function openReschedule(booking: Booking) {
    // Prefill date/time with the current scheduled value so the teacher only
    // adjusts what needs to change. Read the wall-clock in the teacher's
    // profile timezone (the same zone the card shows) — NOT the browser's —
    // so the prefilled value always matches the card's displayed time.
    const w = wallClockInTz(new Date(booking.scheduled_at), timezone)
    setReschedDate(`${w.year}-${w.month}-${w.day}`)
    setReschedTime(`${w.hour}:${w.minute}`)
    setReschedReason('')
    setReschedError('')
    setRescheduleFor(booking)
  }

  function closeReschedule() {
    setRescheduleFor(null)
    setReschedError('')
  }

  function submitReschedule() {
    if (!rescheduleFor) return
    if (!reschedDate || !reschedTime) {
      setReschedError(lang === 'es' ? 'Selecciona fecha y hora' : 'Pick a date and time')
      return
    }
    // Interpret the chosen wall-clock in the teacher's profile timezone (same
    // zone the prefill came from), so the submitted instant equals what the
    // teacher sees on screen.
    const proposed = wallClockToInstant(reschedDate, reschedTime, timezone)
    if (isNaN(proposed.getTime())) {
      setReschedError(lang === 'es' ? 'Fecha/hora inválida' : 'Invalid date/time')
      return
    }
    if (proposed.getTime() < Date.now()) {
      setReschedError(lang === 'es' ? 'La hora no puede estar en el pasado' : 'Time cannot be in the past')
      return
    }
    setReschedError('')
    setReschedSubmitting(true)
    startTransition(async () => {
      const result = await requestReschedule(rescheduleFor.id, proposed.toISOString(), reschedReason)
      setReschedSubmitting(false)
      if (result?.error) {
        setReschedError(result.error)
        return
      }
      // Optimistic: attach a pending request stub so the card badges immediately.
      setConfirmed(prev =>
        prev.map(b =>
          b.id === rescheduleFor.id
            ? {
                ...b,
                reschedule_request: {
                  id: 'pending',
                  proposed_scheduled_at: proposed.toISOString(),
                  status: 'pending',
                },
              }
            : b,
        ),
      )
      closeReschedule()
    })
  }

  function handleCancelReschedule(requestId: string, bookingId: string) {
    startTransition(async () => {
      const result = await cancelRescheduleRequest(requestId)
      if (!result?.error) {
        setConfirmed(prev =>
          prev.map(b => (b.id === bookingId ? { ...b, reschedule_request: null } : b)),
        )
      }
    })
  }

  function handleConfirm(bookingId: string) {
    setLoadingId(bookingId)
    setActionError('')
    startTransition(async () => {
      const result = await confirmBooking(bookingId, lang)
      if (!result?.error) {
        const booking = pending.find(b => b.id === bookingId)
        if (booking) {
          setPending(prev => prev.filter(b => b.id !== bookingId))
          setConfirmed(prev => [{ ...booking, status: 'confirmed' }, ...prev])
        }
      } else {
        setActionError(result.error)
      }
      setLoadingId(null)
    })
  }

  function handleDecline(bookingId: string) {
    setLoadingId(bookingId)
    setActionError('')
    startTransition(async () => {
      const result = await declineBooking(bookingId, lang)
      if (!result?.error) {
        setPending(prev => prev.filter(b => b.id !== bookingId))
      } else {
        setActionError(result.error)
      }
      setLoadingId(null)
    })
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      {actionError && (
        <div
          role="alert"
          onClick={() => setActionError('')}
          style={{
            margin: '12px 16px 0', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            background: '#fdecea', color: '#611a15', fontSize: 14,
            border: '1px solid #f5c6cb',
          }}
        >
          {actionError}
        </div>
      )}

      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          pending.length > 0 ? (
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
                {pending.length}
              </span>
              {lang === 'es' ? 'pendientes' : 'pending'}
            </span>
          ) : null
        }
      />

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Pending requests */}
          <section>
            <SectionHeader
              kicker={tx.pendingKicker}
              title={tx.pending}
              right={
                pending.length > 0 ? (
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--ek-red)',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {pending.length}
                  </span>
                ) : null
              }
            />

            {pending.length > 0 && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--ek-text-muted)' }}>{tx.pendingHint}</p>
            )}

            <AnimatePresence mode="popLayout">
              {pending.length === 0 ? (
                <motion.p
                  key="empty-pending"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-10 text-[14px]"
                  style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}
                >
                  {tx.noPending}
                </motion.p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--ek-border-soft)' }}>
                  {pending.map((booking) => (
                    <motion.li
                      key={booking.id}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      className="py-4"
                      style={{ borderBottom: '1px solid var(--ek-border-soft)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded font-bold text-[12px]"
                          style={{ background: 'var(--ek-red-tint)', color: 'var(--ek-red)' }}
                        >
                          {getInitials(booking.student?.profile?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-[13px] font-semibold" style={{ color: 'var(--ek-text)' }}>
                              {booking.student?.profile?.full_name || 'Student'}
                            </div>
                            {typeLabel(booking.type, tx) && (
                              <TypeChip>{typeLabel(booking.type, tx)}</TypeChip>
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>
                            {formatDate(booking.scheduled_at, lang, tx, timezone)} · {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes}{tx.mins}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              disabled={loadingId === booking.id || isPending}
                              className="ek-red-btn flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3.5 py-2.5 rounded font-semibold text-[12px] disabled:opacity-50"
                              style={{ background: 'var(--ek-red)', color: '#fff' }}
                            >
                              {loadingId === booking.id && (
                                <span className="h-3 w-3 rounded-full border border-white/30 border-t-white animate-spin" />
                              )}
                              {tx.confirm}
                            </button>
                            <button
                              onClick={() => handleDecline(booking.id)}
                              disabled={loadingId === booking.id || isPending}
                              className="ek-outline-btn ek-link-danger flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3.5 py-2.5 rounded font-semibold text-[12px] disabled:opacity-50"
                              style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-soft)', background: 'var(--ek-paper)' }}
                            >
                              {tx.decline}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </AnimatePresence>
          </section>

          {/* Confirmed upcoming */}
          <section>
            <SectionHeader kicker={tx.confirmedKicker} title={tx.upcoming} />

            <AnimatePresence mode="popLayout">
              {confirmed.length === 0 ? (
                <motion.p
                  key="empty-confirmed"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-10 text-[14px]"
                  style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}
                >
                  {tx.noUpcoming}
                </motion.p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--ek-border-soft)' }}>
                  {confirmed.map((booking) => {
                    const canJoin = canEnterRoom(booking.scheduled_at, booking.duration_minutes)
                    const badge = typeLabel(booking.type, tx)
                    const isReschedPending = booking.reschedule_request?.status === 'pending'
                    return (
                      <motion.li
                        key={booking.id}
                        layout
                        className="py-4"
                        style={{ borderBottom: '1px solid var(--ek-border-soft)' }}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded font-bold text-[12px]"
                            style={{ background: 'var(--ek-paper-deep)', color: 'var(--ek-text-soft)' }}
                          >
                            {getInitials(booking.student?.profile?.full_name)}
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ek-text)' }}>
                                {booking.student?.profile?.full_name || 'Student'}
                              </div>
                              {badge && <TypeChip>{badge}</TypeChip>}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                              {formatDate(booking.scheduled_at, lang, tx, timezone)} · {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes}{tx.mins}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isReschedPending ? (
                              <StatusBadge variant="pending">{tx.reschedulePending}</StatusBadge>
                            ) : (
                              <StatusBadge variant="confirmed">{tx.statusConfirmed}</StatusBadge>
                            )}
                            {canJoin && (
                              <Link
                                href={`/${lang}/sala/${booking.id}`}
                                className="ek-red-btn flex items-center gap-1 px-2.5 py-2 rounded font-semibold text-[11px]"
                                style={{ background: 'var(--ek-red)', color: '#fff' }}
                              >
                                <Video className="h-3 w-3" />
                                {tx.join}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                          {isReschedPending ? (
                            <button
                              onClick={() => handleCancelReschedule(booking.reschedule_request!.id, booking.id)}
                              disabled={isPending || booking.reschedule_request!.id === 'pending'}
                              className="ek-outline-btn ek-link-danger flex items-center gap-1 px-2.5 py-2 rounded font-semibold text-[11px] disabled:opacity-50"
                              style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-muted)', background: 'var(--ek-card)' }}
                            >
                              {tx.rescheduleCancel}
                            </button>
                          ) : (
                            <button
                              onClick={() => openReschedule(booking)}
                              className="ek-quickrow flex items-center gap-1 px-2.5 py-2 rounded font-semibold text-[11px]"
                              style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-soft)', background: 'var(--ek-card)' }}
                            >
                              {tx.reschedule}
                            </button>
                          )}
                        </div>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>

      {/* Reschedule modal */}
      <Modal
        open={!!rescheduleFor}
        onClose={closeReschedule}
        kicker={tx.rescheduleKicker}
        title={tx.rescheduleTitle}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={closeReschedule}
              className="ek-outline-btn px-3 py-1.5 rounded font-semibold text-[12px]"
              style={{ color: 'var(--ek-text-soft)', background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              {tx.rescheduleCancelBtn}
            </button>
            <button
              onClick={submitReschedule}
              disabled={reschedSubmitting}
              className="ek-red-btn px-3 py-1.5 rounded font-semibold text-[12px] disabled:opacity-50"
              style={{ background: 'var(--ek-red)', color: '#fff' }}
            >
              {reschedSubmitting ? '…' : tx.rescheduleSubmit}
            </button>
          </div>
        }
      >
        <p className="text-[12px] mb-4" style={{ color: 'var(--ek-text-muted)' }}>{tx.rescheduleSubtitle}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ek-text-soft)' }}>{tx.rescheduleNewDate}</label>
              <input
                type="date"
                value={reschedDate}
                onChange={e => setReschedDate(e.target.value)}
                className="ek-input w-full rounded px-2 py-1.5 text-[13px]"
                style={{ color: 'var(--ek-text)', background: 'var(--ek-card)' }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ek-text-soft)' }}>{tx.rescheduleNewTime}</label>
              <input
                type="time"
                value={reschedTime}
                onChange={e => setReschedTime(e.target.value)}
                className="ek-input w-full rounded px-2 py-1.5 text-[13px]"
                style={{ color: 'var(--ek-text)', background: 'var(--ek-card)' }}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ek-text-soft)' }}>{tx.rescheduleReason}</label>
            <textarea
              value={reschedReason}
              onChange={e => setReschedReason(e.target.value)}
              placeholder={tx.reschedulePlaceholder}
              rows={3}
              className="ek-input w-full rounded px-2 py-1.5 text-[13px] resize-none"
              style={{ color: 'var(--ek-text)', background: 'var(--ek-card)' }}
            />
          </div>
          {reschedError && (
            <p className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{reschedError}</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
