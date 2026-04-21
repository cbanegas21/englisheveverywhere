'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar, ArrowRight, Star, Clock, BookOpen, TrendingUp,
  Video, ChevronRight, AlertCircle, CheckCircle2, Sparkles
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'

const t = {
  en: {
    greeting: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    subtitle: "Here's your English learning overview.",
    stats: {
      classesLeft: 'Classes remaining',
      scheduled: 'Classes scheduled',
      completed: 'Completed sessions',
      totalTime: 'Total studied',
    },
    upcoming: 'Upcoming classes',
    noUpcoming: 'No upcoming classes scheduled.',
    noUpcomingSub: 'Book your first class with a certified teacher.',
    bookNow: 'Book a class',
    with: 'with',
    mins: 'min',
    viewAll: 'View all',
    quickActions: 'Quick actions',
    placementBanner: {
      title: 'Schedule your free evaluation call',
      sub: "Not sure what your level is? Let us figure it out together — free, no pressure, no judgment.",
      cta: 'Get started',
    },
    placementScheduledBanner: {
      title: '✓ Your diagnostic call is scheduled',
      sub: 'View your session details',
      cta: 'View',
    },
    placementPastBanner: {
      title: 'Your diagnostic call has passed',
      sub: (date: string) => `It was scheduled for ${date}. Please contact us to reschedule.`,
      contact: 'hola@englishkolab.com',
    },
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusAwaitingTeacher: 'Awaiting teacher',
    statusLive: 'Live',
    teacherBeingAssigned: 'Teacher being assigned',
    today: 'Today',
    tomorrow: 'Tomorrow',
    upgrade: 'Get more classes',
    noClassesBanner: "You've used all your classes. Get a new pack to keep learning.",
    firstPlanBanner: 'Get your first plan to start learning',
    firstPlanCta: 'See plans',
    actions: {
      book: { title: 'Schedule a class', sub: 'Pick a time with your teacher', href: '/dashboard/agendar' },
      test: { title: 'Placement test', sub: 'Find your exact level', href: '/dashboard/placement' },
      testScheduled: { title: 'View diagnostic call', sub: 'See your scheduled session', href: '/dashboard/placement' },
      progress: { title: 'My progress', sub: 'Track your improvement', href: '/dashboard/progreso' },
    },
  },
  es: {
    greeting: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    subtitle: 'Resumen de tu aprendizaje de inglés.',
    stats: {
      classesLeft: 'Clases disponibles',
      scheduled: 'Clases agendadas',
      completed: 'Sesiones completadas',
      totalTime: 'Total estudiado',
    },
    upcoming: 'Próximas clases',
    noUpcoming: 'No tienes clases agendadas.',
    noUpcomingSub: 'Agenda tu primera clase con un maestro certificado.',
    bookNow: 'Agendar clase',
    with: 'con',
    mins: 'min',
    viewAll: 'Ver todas',
    quickActions: 'Acciones rápidas',
    placementBanner: {
      title: 'Agenda tu llamada de diagnóstico gratuita',
      sub: '¿No sabes cuál es tu nivel? Lo descubrimos juntos — gratis, sin presión, sin juicios.',
      cta: 'Comenzar',
    },
    placementScheduledBanner: {
      title: '✓ Tu llamada diagnóstica está agendada',
      sub: 'Ver detalles de tu sesión',
      cta: 'Ver',
    },
    placementPastBanner: {
      title: 'Tu llamada diagnóstica ya pasó',
      sub: (date: string) => `Estaba agendada para el ${date}. Contáctanos para reagendar.`,
      contact: 'hola@englishkolab.com',
    },
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusAwaitingTeacher: 'Asignando maestro',
    statusLive: 'En vivo',
    teacherBeingAssigned: 'Maestro por asignar',
    today: 'Hoy',
    tomorrow: 'Mañana',
    upgrade: 'Obtener más clases',
    noClassesBanner: 'Usaste todas tus clases. Obtén un nuevo pack para seguir aprendiendo.',
    firstPlanBanner: 'Adquiere tu primer plan para comenzar a aprender',
    firstPlanCta: 'Ver planes',
    actions: {
      book: { title: 'Agendar clase', sub: 'Elige tu horario', href: '/dashboard/agendar' },
      test: { title: 'Placement test', sub: 'Encuentra tu nivel exacto', href: '/dashboard/placement' },
      testScheduled: { title: 'Ver llamada diagnóstica', sub: 'Ver tu sesión agendada', href: '/dashboard/placement' },
      progress: { title: 'Mi progreso', sub: 'Sigue tu mejora', href: '/dashboard/progreso' },
    },
  },
}

function getGreeting(lang: Locale, timezone: string) {
  let h: number
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(new Date())
    h = parseInt(hourStr, 10)
    if (isNaN(h)) h = new Date().getHours()
  } catch {
    h = new Date().getHours()
  }
  const tx = t[lang]
  if (h < 12) return tx.greeting
  if (h < 18) return tx.greetingAfternoon
  return tx.greetingEvening
}

// Date helpers compare against the *student's* timezone, not the browser's.
// A booking stored at 2026-04-22T00:30:00Z reads as "Apr 21" in America/Bogota
// (UTC-5) but "Apr 22" in America/Tegucigalpa. We pin to the student's tz so
// the calendar-cell day matches the time label beneath it.
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
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', timeZone,
  })
}

function dayInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(new Date(iso))
}

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher_id?: string | null
  teacher?: { profile?: { full_name?: string } } | null
}

interface Props {
  lang: Locale
  userName: string
  timezone: string
  classesRemaining: number
  currentPlan: string | null
  placementTestDone: boolean
  placementScheduled: boolean
  placementScheduledAt: string | null
  completedSessions: number
  scheduledClasses: number
  upcomingBookings: Booking[]
}

export default function StudentDashboardClient({
  lang,
  userName,
  timezone,
  classesRemaining,
  currentPlan,
  placementTestDone,
  placementScheduled,
  placementScheduledAt,
  completedSessions,
  scheduledClasses,
  upcomingBookings,
}: Props) {
  const tx = t[lang]
  const firstName = userName.split(' ')[0]

  // Tick once a minute so the "Live" badge flips when a session starts/ends
  // without needing a full page reload. Hydration-safe: null on SSR.
  // React-19 rules-of-hooks forbids synchronous setState inside an effect,
  // so defer the initial set via a 0-ms timeout.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0)
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => { clearTimeout(t); clearInterval(id) }
  }, [])

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Top greeting bar */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>
          {getGreeting(lang, timezone)}, {firstName}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

        {/* Placement banner — 3 states */}
        {!placementTestDone && !placementScheduled && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
              style={{ background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.15)' }}
            >
              <AlertCircle className="h-5 w-5" style={{ color: '#C41E3A' }} />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>{tx.placementBanner.title}</div>
              <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: '#9CA3AF' }}>{tx.placementBanner.sub}</div>
            </div>
            <Link
              href={`/${lang}/dashboard/placement`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
            >
              {tx.placementBanner.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        {!placementTestDone && placementScheduled && (() => {
          // "Past" only after the live window closes (scheduled + duration +
          // 90-min late cap that matches src/app/actions/video.ts getRoomAccess).
          // Without this grace, the banner flips to "has passed" while the
          // student is actively in the call.
          const PLACEMENT_LIVE_WINDOW_MS = (60 + 90) * 60_000
          // Before hydration (now === null), treat as not-past — safer than
          // flashing "has passed" briefly on load.
          const isPast = placementScheduledAt && now !== null
            ? now > new Date(placementScheduledAt).getTime() + PLACEMENT_LIVE_WINDOW_MS
            : false
          const formattedDate = placementScheduledAt
            ? new Date(placementScheduledAt).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })
            : ''

          if (isPast) {
            return (
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                  style={{ background: '#FEF3C7' }}
                >
                  <AlertCircle className="h-5 w-5" style={{ color: '#D97706' }} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold" style={{ color: '#92400E' }}>{tx.placementPastBanner.title}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#B45309' }}>{tx.placementPastBanner.sub(formattedDate)}</div>
                </div>
                <a
                  href={`mailto:${tx.placementPastBanner.contact}`}
                  className="flex-shrink-0 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
                  style={{ background: '#D97706', color: '#fff' }}
                >
                  {lang === 'es' ? 'Contactar' : 'Contact us'}
                </a>
              </div>
            )
          }

          return (
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: '#fff', border: '1px solid #86EFAC' }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                style={{ background: '#F0FDF4' }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: '#16A34A' }} />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>{tx.placementScheduledBanner.title}</div>
                <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.placementScheduledBanner.sub}</div>
              </div>
              <Link
                href={`/${lang}/dashboard/placement`}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
                style={{ background: '#16A34A', color: '#fff' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#15803D')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#16A34A')}
              >
                {tx.placementScheduledBanner.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )
        })()}

        {/* No classes banner — fresh account vs used up */}
        {classesRemaining === 0 && !currentPlan && completedSessions === 0 && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
              style={{ background: '#F3F4F6' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: '#9CA3AF' }} />
            </div>
            <p className="flex-1 text-[13px]" style={{ color: '#4B5563' }}>{tx.firstPlanBanner}</p>
            <Link
              href={`/${lang}/dashboard/plan`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
            >
              {tx.firstPlanCta}
            </Link>
          </div>
        )}
        {classesRemaining === 0 && (currentPlan !== null || completedSessions > 0) && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#fff', border: '1px solid #FCA5A5' }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
              style={{ background: '#FEF2F2' }}
            >
              <BookOpen className="h-5 w-5" style={{ color: '#DC2626' }} />
            </div>
            <p className="flex-1 text-[13px]" style={{ color: '#4B5563' }}>{tx.noClassesBanner}</p>
            <Link
              href={`/${lang}/dashboard/plan`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
            >
              {tx.upgrade}
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: tx.stats.classesLeft,
              value: classesRemaining,
              icon: BookOpen,
              urgent: classesRemaining === 0,
            },
            {
              label: tx.stats.scheduled,
              value: scheduledClasses,
              icon: Calendar,
            },
            {
              label: tx.stats.completed,
              value: completedSessions,
              icon: CheckCircle2,
            },
            {
              label: tx.stats.totalTime,
              value: completedSessions > 0 ? `${completedSessions * 60}m` : '0m',
              icon: Clock,
              note: completedSessions === 0
                ? (lang === 'es' ? 'Completa tu primera clase' : 'Complete your first class')
                : undefined,
            },
          ].map(({ label, value, icon: Icon, urgent, note }) => (
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
              <div
                className="text-[24px] font-black mb-0.5"
                style={{ color: urgent ? '#DC2626' : '#111111' }}
              >
                {value}
              </div>
              <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{label}</div>
              {note && (
                <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>{note}</p>
              )}
            </div>
          ))}
        </div>

        {/* Main content: upcoming + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Upcoming classes — left 3/5 */}
          <div
            className="lg:col-span-3 rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.upcoming}</h2>
              <Link
                href={`/${lang}/dashboard/clases`}
                className="text-[12px] flex items-center gap-1 transition-colors"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
              >
                {tx.viewAll}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {upcomingBookings.length === 0 ? (
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
                  href={`/${lang}/dashboard/agendar`}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded font-semibold text-[12px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                >
                  {tx.bookNow}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul>
                {upcomingBookings.map((booking) => {
                  const teacherName = (booking.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name || null
                  const awaitingTeacher = !teacherName && booking.status === 'pending'
                  const startMs = new Date(booking.scheduled_at).getTime()
                  const endMs = startMs + (booking.duration_minutes || 60) * 60_000
                  const isLive = now !== null && now >= startMs && now <= endMs
                  return (
                    <li
                      key={booking.id}
                      className="flex items-center gap-4 px-5 py-4"
                      style={{ borderBottom: '1px solid #E5E7EB' }}
                    >
                      <div className="flex-shrink-0 text-center w-10">
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                          {formatDate(booking.scheduled_at, lang, timezone).slice(0, 3)}
                        </div>
                        <div className="text-[18px] font-black leading-none mt-0.5" style={{ color: '#111111' }}>
                          {dayInTz(booking.scheduled_at, timezone)}
                        </div>
                      </div>

                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded"
                        style={{ background: '#F3F4F6' }}
                      >
                        <Video className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: awaitingTeacher ? '#9CA3AF' : '#111111', fontStyle: awaitingTeacher ? 'italic' : 'normal' }}>
                          {awaitingTeacher ? tx.teacherBeingAssigned : `${tx.with} ${teacherName}`}
                        </div>
                        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
                          {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes}{tx.mins}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1.5"
                          style={
                            isLive
                              ? { background: '#C41E3A', color: '#fff', border: '1px solid #C41E3A' }
                              : booking.status === 'confirmed'
                              ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
                              : awaitingTeacher
                              ? { background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D' }
                              : { background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }
                          }
                        >
                          {isLive && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#fff' }} />
                          )}
                          {isLive
                            ? tx.statusLive
                            : booking.status === 'confirmed'
                            ? tx.statusConfirmed
                            : awaitingTeacher
                            ? tx.statusAwaitingTeacher
                            : tx.statusPending}
                        </span>
                        {!awaitingTeacher && (
                          <JoinSessionButton
                            lang={lang}
                            bookingId={booking.id}
                            scheduledAt={booking.scheduled_at}
                            variant="compact"
                          />
                        )}
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
              { href: tx.actions.book.href, icon: Video, title: tx.actions.book.title, sub: tx.actions.book.sub },
              ...(placementTestDone
                ? []
                : [{
                    href: placementScheduled ? tx.actions.testScheduled.href : tx.actions.test.href,
                    icon: Star,
                    title: placementScheduled ? tx.actions.testScheduled.title : tx.actions.test.title,
                    sub: placementScheduled ? tx.actions.testScheduled.sub : tx.actions.test.sub,
                  }]
              ),
              { href: tx.actions.progress.href, icon: TrendingUp, title: tx.actions.progress.title, sub: tx.actions.progress.sub },
            ] as Array<{ href: string; icon: React.ElementType; title: string; sub: string }>).map(({ href, icon: Icon, title, sub }) => (
              <Link key={title} href={`/${lang}${href}`}>
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
