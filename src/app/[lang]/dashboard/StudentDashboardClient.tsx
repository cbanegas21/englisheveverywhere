'use client'

import Link from 'next/link'
import {
  Calendar, ArrowRight, Star, Clock, BookOpen, TrendingUp,
  Video, ChevronRight, AlertCircle, CheckCircle2, Sparkles
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    greeting: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    subtitle: "Here's your English learning overview.",
    stats: {
      classesLeft: 'Classes remaining',
      completed: 'Completed sessions',
      level: 'Current level',
      noLevel: 'Diagnostic call pending',
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
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
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
      completed: 'Sesiones completadas',
      level: 'Nivel actual',
      noLevel: 'Llamada diagnóstica pendiente',
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
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
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

function formatDate(iso: string, lang: Locale) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tx = t[lang]
  if (d.toDateString() === now.toDateString()) return tx.today
  if (d.toDateString() === tomorrow.toDateString()) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher?: { profile?: { full_name?: string } } | null
}

interface Props {
  lang: Locale
  userName: string
  timezone: string
  level: string | null
  classesRemaining: number
  currentPlan: string | null
  placementTestDone: boolean
  placementScheduled: boolean
  completedSessions: number
  upcomingBookings: Booking[]
}

export default function StudentDashboardClient({
  lang,
  userName,
  timezone,
  level,
  classesRemaining,
  currentPlan,
  placementTestDone,
  placementScheduled,
  completedSessions,
  upcomingBookings,
}: Props) {
  const tx = t[lang]
  const firstName = userName.split(' ')[0]

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
        {!placementTestDone && placementScheduled && (
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
        )}

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
              label: tx.stats.completed,
              value: completedSessions,
              icon: CheckCircle2,
            },
            {
              label: level ? tx.stats.level : tx.stats.noLevel,
              value: level || (placementTestDone ? (lang === 'es' ? 'Agendada ✓' : 'Scheduled ✓') : '—'),
              icon: TrendingUp,
              link: (!level && !placementTestDone) ? `/${lang}/dashboard/placement` : undefined,
            },
            {
              label: tx.stats.totalTime,
              value: completedSessions > 0 ? `${completedSessions * 60}m` : '0m',
              icon: Clock,
              note: completedSessions === 0
                ? (lang === 'es' ? 'Completa tu primera clase' : 'Complete your first class')
                : undefined,
            },
          ].map(({ label, value, icon: Icon, urgent, link, note }) => (
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
              {link && (
                <Link
                  href={link}
                  className="text-[11px] underline mt-1 block transition-colors"
                  style={{ color: '#C41E3A' }}
                >
                  {lang === 'es' ? 'Agendar llamada diagnóstica gratuita →' : 'Schedule your free diagnostic call →'}
                </Link>
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
                {upcomingBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: '1px solid #E5E7EB' }}
                  >
                    <div className="flex-shrink-0 text-center w-10">
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                        {formatDate(booking.scheduled_at, lang).slice(0, 3)}
                      </div>
                      <div className="text-[18px] font-black leading-none mt-0.5" style={{ color: '#111111' }}>
                        {new Date(booking.scheduled_at).getDate()}
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
                        {tx.with} {(booking.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name || 'Teacher'}
                      </div>
                      <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {formatTime(booking.scheduled_at)} · {booking.duration_minutes}{tx.mins}
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-semibold px-2.5 py-1 rounded flex-shrink-0"
                      style={
                        booking.status === 'confirmed'
                          ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
                          : { background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }
                      }
                    >
                      {booking.status === 'confirmed' ? tx.statusConfirmed : tx.statusPending}
                    </span>
                  </li>
                ))}
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
