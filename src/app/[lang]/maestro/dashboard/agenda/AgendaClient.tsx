'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, CheckCircle2, X, Clock, Video, Users, AlertCircle, CalendarClock } from 'lucide-react'
import { confirmBooking, declineBooking, requestReschedule, cancelRescheduleRequest } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

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
    pending: 'Pending requests',
    noPending: 'No pending booking requests.',
    upcoming: 'Upcoming confirmed sessions',
    noUpcoming: 'No upcoming sessions.',
    confirm: 'Confirm',
    decline: 'Decline',
    join: 'Join room',
    mins: 'min',
    with: 'Student:',
    today: 'Today',
    tomorrow: 'Tomorrow',
    statusConfirmed: 'Confirmed',
    typePlacement: 'Placement',
    typeCheckin: 'Check-in',
    typeClass: 'Class',
    reschedule: 'Request reschedule',
    reschedulePending: 'Reschedule pending',
    rescheduleCancel: 'Cancel request',
    rescheduleTitle: 'Request a reschedule',
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
    subtitle: 'Gestiona tus solicitudes y sesiones próximas.',
    pending: 'Solicitudes pendientes',
    noPending: 'Sin solicitudes de reserva pendientes.',
    upcoming: 'Sesiones confirmadas próximas',
    noUpcoming: 'Sin sesiones próximas.',
    confirm: 'Confirmar',
    decline: 'Rechazar',
    join: 'Entrar a sala',
    mins: 'min',
    with: 'Estudiante:',
    today: 'Hoy',
    tomorrow: 'Mañana',
    statusConfirmed: 'Confirmada',
    typePlacement: 'Nivelación',
    typeCheckin: 'Check-in',
    typeClass: 'Clase',
    reschedule: 'Solicitar reagendar',
    reschedulePending: 'Reagendamiento pendiente',
    rescheduleCancel: 'Cancelar solicitud',
    rescheduleTitle: 'Solicitar reagendar',
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

  function openReschedule(booking: Booking) {
    // Prefill date/time with current scheduled value so the teacher only
    // adjusts what needs to change.
    const d = new Date(booking.scheduled_at)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    setReschedDate(`${y}-${m}-${day}`)
    setReschedTime(`${hh}:${mm}`)
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
    const proposed = new Date(`${reschedDate}T${reschedTime}`)
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
    startTransition(async () => {
      const result = await confirmBooking(bookingId, lang)
      if (!result?.error) {
        const booking = pending.find(b => b.id === bookingId)
        if (booking) {
          setPending(prev => prev.filter(b => b.id !== bookingId))
          setConfirmed(prev => [{ ...booking, status: 'confirmed' }, ...prev])
        }
      }
      setLoadingId(null)
    })
  }

  function handleDecline(bookingId: string) {
    setLoadingId(bookingId)
    startTransition(async () => {
      const result = await declineBooking(bookingId, lang)
      if (!result?.error) {
        setPending(prev => prev.filter(b => b.id !== bookingId))
      }
      setLoadingId(null)
    })
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
          {pending.length > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded ml-2"
              style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {pending.length}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Pending requests */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded"
                  style={{ background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.15)' }}
                >
                  <Clock className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                </div>
                <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.pending}</h2>
              </div>
              {pending.length > 0 && (
                <span
                  className="text-[10px] font-bold rounded px-2 py-0.5"
                  style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                >
                  {pending.length}
                </span>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {pending.length === 0 ? (
                <motion.div
                  key="empty-pending"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center px-6"
                >
                  <Calendar className="h-8 w-8 mb-3" style={{ color: '#E5E7EB' }} />
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noPending}</p>
                </motion.div>
              ) : (
                <ul>
                  {pending.map((booking) => (
                    <motion.li
                      key={booking.id}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 py-4"
                      style={{ borderBottom: '1px solid #E5E7EB' }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded font-bold text-[12px]"
                          style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                        >
                          {getInitials(booking.student?.profile?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                              {booking.student?.profile?.full_name || 'Student'}
                            </div>
                            {typeLabel(booking.type, tx) && (
                              <span
                                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
                              >
                                {typeLabel(booking.type, tx)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            {formatDate(booking.scheduled_at, lang, tx, timezone)} · {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes}{tx.mins}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              disabled={loadingId === booking.id || isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold text-[11px] transition-all disabled:opacity-50"
                              style={{ background: '#C41E3A', color: '#fff' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
                            >
                              {loadingId === booking.id ? (
                                <span className="h-3 w-3 rounded-full border border-white/30 border-t-white animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {tx.confirm}
                            </button>
                            <button
                              onClick={() => handleDecline(booking.id)}
                              disabled={loadingId === booking.id || isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold text-[11px] transition-all disabled:opacity-50"
                              style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#4B5563' }}
                            >
                              <X className="h-3 w-3" />
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
          </div>

          {/* Confirmed upcoming */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div
                className="flex h-7 w-7 items-center justify-center rounded"
                style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}
              >
                <Calendar className="h-3.5 w-3.5" style={{ color: '#16A34A' }} />
              </div>
              <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.upcoming}</h2>
            </div>

            <AnimatePresence mode="popLayout">
              {confirmed.length === 0 ? (
                <motion.div
                  key="empty-confirmed"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center px-6"
                >
                  <Users className="h-8 w-8 mb-3" style={{ color: '#E5E7EB' }} />
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noUpcoming}</p>
                </motion.div>
              ) : (
                <ul>
                  {confirmed.map((booking) => {
                    const canJoin = canEnterRoom(booking.scheduled_at, booking.duration_minutes)
                    const badge = typeLabel(booking.type, tx)
                    return (
                      <motion.li
                        key={booking.id}
                        layout
                        className="px-5 py-4"
                        style={{ borderBottom: '1px solid #E5E7EB' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded font-bold text-[12px]"
                            style={{ background: '#F3F4F6', color: '#4B5563' }}
                          >
                            {getInitials(booking.student?.profile?.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>
                                {booking.student?.profile?.full_name || 'Student'}
                              </div>
                              {badge && (
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                  style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
                                >
                                  {badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
                              {formatDate(booking.scheduled_at, lang, tx, timezone)} · {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes}{tx.mins}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {booking.reschedule_request?.status === 'pending' ? (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                                style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
                              >
                                {tx.reschedulePending}
                              </span>
                            ) : (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                                style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}
                              >
                                {tx.statusConfirmed}
                              </span>
                            )}
                            {canJoin && (
                              <Link
                                href={`/${lang}/sala/${booking.id}`}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded font-semibold text-[10px] transition-all"
                                style={{ background: '#C41E3A', color: '#fff' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                              >
                                <Video className="h-3 w-3" />
                                {tx.join}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                          {booking.reschedule_request?.status === 'pending' ? (
                            <button
                              onClick={() => handleCancelReschedule(booking.reschedule_request!.id, booking.id)}
                              disabled={isPending || booking.reschedule_request.id === 'pending'}
                              className="flex items-center gap-1 px-2 py-1 rounded font-semibold text-[10px] transition-all disabled:opacity-50"
                              style={{ border: '1px solid #E5E7EB', color: '#9CA3AF', background: '#fff' }}
                              onMouseEnter={e => { if (!isPending) { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FCA5A5' } }}
                              onMouseLeave={e => { if (!isPending) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = '#E5E7EB' } }}
                            >
                              <X className="h-3 w-3" />
                              {tx.rescheduleCancel}
                            </button>
                          ) : (
                            <button
                              onClick={() => openReschedule(booking)}
                              className="flex items-center gap-1 px-2 py-1 rounded font-semibold text-[10px] transition-all"
                              style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C41E3A'; e.currentTarget.style.color = '#C41E3A' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#4B5563' }}
                            >
                              <CalendarClock className="h-3 w-3" />
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
          </div>
        </div>
      </div>

      {/* Reschedule modal */}
      <AnimatePresence>
        {rescheduleFor && (
          <motion.div
            key="resched-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={closeReschedule}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-xl"
              style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <h3 className="text-[15px] font-black" style={{ color: '#111111' }}>{tx.rescheduleTitle}</h3>
                  <p className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.rescheduleSubtitle}</p>
                </div>
                <button
                  onClick={closeReschedule}
                  className="rounded p-1 -mt-0.5 -mr-1"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#111111'; e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold block mb-1" style={{ color: '#4B5563' }}>{tx.rescheduleNewDate}</label>
                    <input
                      type="date"
                      value={reschedDate}
                      onChange={e => setReschedDate(e.target.value)}
                      className="w-full rounded px-2 py-1.5 text-[13px] outline-none"
                      style={{ border: '1px solid #E5E7EB', color: '#111111' }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold block mb-1" style={{ color: '#4B5563' }}>{tx.rescheduleNewTime}</label>
                    <input
                      type="time"
                      value={reschedTime}
                      onChange={e => setReschedTime(e.target.value)}
                      className="w-full rounded px-2 py-1.5 text-[13px] outline-none"
                      style={{ border: '1px solid #E5E7EB', color: '#111111' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold block mb-1" style={{ color: '#4B5563' }}>{tx.rescheduleReason}</label>
                  <textarea
                    value={reschedReason}
                    onChange={e => setReschedReason(e.target.value)}
                    placeholder={tx.reschedulePlaceholder}
                    rows={3}
                    className="w-full rounded px-2 py-1.5 text-[13px] outline-none resize-none"
                    style={{ border: '1px solid #E5E7EB', color: '#111111' }}
                  />
                </div>
                {reschedError && (
                  <p className="text-[12px]" style={{ color: '#DC2626' }}>{reschedError}</p>
                )}
              </div>

              <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <button
                  onClick={closeReschedule}
                  className="px-3 py-1.5 rounded font-semibold text-[12px] transition-all"
                  style={{ color: '#4B5563', background: '#fff', border: '1px solid #E5E7EB' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                >
                  {tx.rescheduleCancelBtn}
                </button>
                <button
                  onClick={submitReschedule}
                  disabled={reschedSubmitting}
                  className="px-3 py-1.5 rounded font-semibold text-[12px] transition-all disabled:opacity-50"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (!reschedSubmitting) e.currentTarget.style.background = '#9E1830' }}
                  onMouseLeave={e => { if (!reschedSubmitting) e.currentTarget.style.background = '#C41E3A' }}
                >
                  {reschedSubmitting ? '…' : tx.rescheduleSubmit}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
