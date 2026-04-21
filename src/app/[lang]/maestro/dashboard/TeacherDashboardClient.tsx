'use client'

import Link from 'next/link'
import {
  Calendar, Star, Users, ArrowRight,
  Video, ChevronRight, Clock, ToggleLeft, ToggleRight,
  CheckCircle2, BarChart3
} from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'

const t = {
  en: {
    greeting: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    subtitle: 'Your teaching overview for today.',
    activeToggle: 'Accepting students',
    inactiveToggle: 'Not accepting',
    stats: {
      sessions: 'Sessions this month',
      total: 'Total sessions',
      rating: 'Your rating',
    },
    upcoming: 'Upcoming sessions',
    noUpcoming: 'No upcoming sessions scheduled.',
    noUpcomingSub: 'Set your availability to start receiving bookings.',
    setAvailability: 'Set availability',
    with: 'with',
    mins: 'min',
    viewAll: 'View schedule',
    quickActions: 'Quick actions',
    actions: {
      availability: { title: 'Set availability', sub: 'Define your open time slots', href: '/maestro/dashboard/disponibilidad' },
      students: { title: 'My students', sub: 'View your active students', href: '/maestro/dashboard/estudiantes' },
      sessions: { title: 'Session history', sub: 'View completed sessions', href: '/maestro/dashboard/ganancias' },
    },
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusLive: 'Live',
    today: 'Today',
    tomorrow: 'Tomorrow',
    specs: 'Specializations',
  },
  es: {
    greeting: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    subtitle: 'Tu resumen de enseñanza de hoy.',
    activeToggle: 'Aceptando estudiantes',
    inactiveToggle: 'No disponible',
    stats: {
      sessions: 'Sesiones este mes',
      total: 'Total de sesiones',
      rating: 'Tu calificación',
    },
    upcoming: 'Próximas sesiones',
    noUpcoming: 'No tienes sesiones próximas.',
    noUpcomingSub: 'Define tu disponibilidad para comenzar a recibir reservas.',
    setAvailability: 'Definir disponibilidad',
    with: 'con',
    mins: 'min',
    viewAll: 'Ver agenda',
    quickActions: 'Acciones rápidas',
    actions: {
      availability: { title: 'Disponibilidad', sub: 'Define tus horarios libres', href: '/maestro/dashboard/disponibilidad' },
      students: { title: 'Mis estudiantes', sub: 'Ver tus estudiantes activos', href: '/maestro/dashboard/estudiantes' },
      sessions: { title: 'Historial de sesiones', sub: 'Ver clases completadas', href: '/maestro/dashboard/ganancias' },
    },
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusLive: 'En vivo',
    today: 'Hoy',
    tomorrow: 'Mañana',
    specs: 'Especializaciones',
  },
}

function getGreeting(lang: Locale) {
  const h = new Date().getHours()
  const tx = t[lang]
  if (h < 12) return tx.greeting
  if (h < 18) return tx.greetingAfternoon
  return tx.greetingEvening
}

function ymdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function formatDate(iso: string, lang: Locale, timeZone: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  const tx = t[lang]
  if (ymdInTz(d, timeZone) === ymdInTz(now, timeZone)) return tx.today
  if (ymdInTz(d, timeZone) === ymdInTz(tomorrow, timeZone)) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone,
  })
}

function formatTime(iso: string, lang: 'es' | 'en', timeZone: string) {
  // Pin locale + tz to keep SSR + client output identical (hydration-safe).
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', timeZone,
  })
}

function dayInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(new Date(iso))
}

interface Session {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student?: { profile?: { full_name?: string } } | null
}

interface Props {
  lang: Locale
  profileId: string
  userName: string
  timezone: string
  rating: number
  totalSessions: number
  isActive: boolean
  specializations: string[]
  thisMonthSessions: number
  upcomingSessions: Session[]
}

export default function TeacherDashboardClient({
  lang,
  profileId,
  userName,
  timezone,
  rating,
  totalSessions,
  isActive: initialActive,
  specializations,
  thisMonthSessions,
  upcomingSessions,
}: Props) {
  const tx = t[lang]
  const firstName = userName.split(' ')[0]
  const [active, setActive] = useState(initialActive)

  // Minute-tick drives the "Live" badge transition. Null on SSR for
  // hydration safety; React-19 rules-of-hooks forbids synchronous setState
  // inside an effect, so defer the initial set via a 0-ms timeout.
  const [nowTick, setNowTick] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setNowTick(Date.now()), 0)
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => { clearTimeout(t); clearInterval(id) }
  }, [])
  const [isPending, startTransition] = useTransition()

  function toggleActive() {
    const supabase = createClient()
    startTransition(async () => {
      await supabase
        .from('teachers')
        .update({ is_active: !active })
        .eq('profile_id', profileId)
      setActive(!active)
    })
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Top header bar */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>
              {getGreeting(lang)}, {firstName}
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>

          {/* Active/inactive toggle */}
          <button
            onClick={toggleActive}
            disabled={isPending}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded text-[13px] font-semibold transition-all flex-shrink-0"
            style={
              active
                ? { border: '1px solid #86EFAC', background: '#F0FDF4', color: '#16A34A' }
                : { border: '1px solid #E5E7EB', background: '#fff', color: '#4B5563' }
            }
          >
            {active
              ? <ToggleRight className="h-4 w-4" style={{ color: '#16A34A' }} />
              : <ToggleLeft className="h-4 w-4" style={{ color: '#9CA3AF' }} />
            }
            {active ? tx.activeToggle : tx.inactiveToggle}
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

        {/* Specializations info bar */}
        {specializations.length > 0 && (
          <div
            className="rounded-xl p-4 flex flex-wrap items-center gap-3"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <span
              className="text-[11px] uppercase tracking-wider font-semibold flex-shrink-0"
              style={{ color: '#9CA3AF' }}
            >
              {tx.specs}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {specializations.slice(0, 5).map(s => (
                <span
                  key={s}
                  className="text-[11px] px-2.5 py-1 rounded font-medium"
                  style={{ background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}
                >
                  {s}
                </span>
              ))}
              {specializations.length > 5 && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded"
                  style={{ background: '#F3F4F6', color: '#9CA3AF' }}
                >
                  +{specializations.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: tx.stats.sessions, value: thisMonthSessions, icon: Video },
            { label: tx.stats.total, value: totalSessions, icon: CheckCircle2 },
            { label: tx.stats.rating, value: rating > 0 ? rating.toFixed(1) : '—', icon: Star, isRating: true },
          ].map(({ label, value, icon: Icon, isRating }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded"
                  style={{ background: '#F3F4F6' }}
                >
                  <Icon className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                {isRating && value !== '—' && (
                  <Star className="h-4 w-4 flex-shrink-0" style={{ color: '#C41E3A', fill: '#C41E3A' }} />
                )}
                <span className="text-[24px] font-black" style={{ color: '#111111' }}>{value}</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Upcoming sessions — left 3/5 */}
          <div
            className="lg:col-span-3 rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.upcoming}</h2>
              <Link
                href={`/${lang}/maestro/dashboard/agenda`}
                className="text-[12px] flex items-center gap-1 transition-colors"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
              >
                {tx.viewAll}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                  style={{ background: '#F3F4F6' }}
                >
                  <Calendar className="h-6 w-6" style={{ color: '#9CA3AF' }} />
                </div>
                <p className="text-[13px] font-semibold mb-1" style={{ color: '#111111' }}>{tx.noUpcoming}</p>
                <p className="text-[12px] mb-5" style={{ color: '#9CA3AF' }}>{tx.noUpcomingSub}</p>
                <Link
                  href={`/${lang}/maestro/dashboard/disponibilidad`}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded font-semibold text-[12px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                >
                  {tx.setAvailability}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul>
                {upcomingSessions.map((session) => {
                  const startMs = new Date(session.scheduled_at).getTime()
                  const endMs = startMs + (session.duration_minutes || 60) * 60_000
                  const isLive = nowTick !== null && nowTick >= startMs && nowTick <= endMs
                  return (
                  <li
                    key={session.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: '1px solid #E5E7EB' }}
                  >
                    <div className="flex-shrink-0 text-center w-10">
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                        {formatDate(session.scheduled_at, lang, timezone).slice(0, 3)}
                      </div>
                      <div className="text-[18px] font-black leading-none mt-0.5" style={{ color: '#111111' }}>
                        {dayInTz(session.scheduled_at, timezone)}
                      </div>
                    </div>

                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded"
                      style={{ background: '#F3F4F6' }}
                    >
                      <Video className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>
                        {tx.with} {(session.student as { profile?: { full_name?: string } } | null)?.profile?.full_name || 'Student'}
                      </div>
                      <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {formatTime(session.scheduled_at, lang, timezone)} · {session.duration_minutes}{tx.mins}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1.5"
                        style={
                          isLive
                            ? { background: '#C41E3A', color: '#fff', border: '1px solid #C41E3A' }
                            : session.status === 'confirmed'
                            ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
                            : { background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }
                        }
                      >
                        {isLive && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#fff' }} />
                        )}
                        {isLive ? tx.statusLive : session.status === 'confirmed' ? tx.statusConfirmed : tx.statusPending}
                      </span>
                      <JoinSessionButton
                        lang={lang}
                        bookingId={session.id}
                        scheduledAt={session.scheduled_at}
                        variant="compact"
                      />
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Quick actions — right 2/5 */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-[14px] font-bold mb-1" style={{ color: '#111111' }}>{tx.quickActions}</h2>
            {([
              { href: tx.actions.availability.href, icon: Clock, title: tx.actions.availability.title, sub: tx.actions.availability.sub },
              { href: tx.actions.students.href, icon: Users, title: tx.actions.students.title, sub: tx.actions.students.sub },
              { href: tx.actions.sessions.href, icon: BarChart3, title: tx.actions.sessions.title, sub: tx.actions.sessions.sub },
            ] as Array<{ href: string; icon: React.ElementType; title: string; sub: string }>).map(({ href, icon: Icon, title, sub }) => (
              <Link key={href} href={`/${lang}${href}`}>
                <div
                  className="flex items-center gap-3.5 p-4 rounded-xl transition-all cursor-pointer"
                  style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded"
                    style={{ background: '#F3F4F6' }}
                  >
                    <Icon className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>{title}</div>
                    <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{sub}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#E5E7EB' }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
