'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, CheckCircle2, X, Clock, Video, Users, AlertCircle } from 'lucide-react'
import { confirmBooking, declineBooking } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  type?: string | null
  student?: { profile?: { full_name?: string; avatar_url?: string } } | null
}

interface Props {
  lang: Locale
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
  },
}

function formatDate(iso: string, lang: Locale, tx: typeof t['en']) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return tx.today
  if (d.toDateString() === tomorrow.toDateString()) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  })
}

function formatTime(iso: string, lang: 'es' | 'en') {
  // Pin the locale so SSR and client render identically — passing []
  // picks up the env locale, which differs between Node and browser and
  // causes hydration mismatches (e.g. "04:00 PM" vs "04:00 p.m.").
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
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

export default function AgendaClient({ lang, pendingBookings, confirmedBookings }: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [pending, setPending] = useState<Booking[]>(pendingBookings)
  const [confirmed, setConfirmed] = useState<Booking[]>(confirmedBookings)
  const [loadingId, setLoadingId] = useState<string | null>(null)

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
                            {formatDate(booking.scheduled_at, lang, tx)} · {formatTime(booking.scheduled_at, lang)} · {booking.duration_minutes}{tx.mins}
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
                              {formatDate(booking.scheduled_at, lang, tx)} · {formatTime(booking.scheduled_at, lang)} · {booking.duration_minutes}{tx.mins}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}
                            >
                              {tx.statusConfirmed}
                            </span>
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
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
