'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StatLedger } from '@/components/ui/StatLedger'

const t = {
  en: {
    greeting: 'good morning',
    greetingAfternoon: 'good afternoon',
    greetingEvening: 'good evening',
    subtitleSuffix: "· Here's your day",
    classesAvailable: (n: number) => `${n} ${n === 1 ? 'class' : 'classes'} available`,
    addClass: '+ Schedule class',
    nextClass: 'Next class',
    yourTeacher: 'Your teacher',
    teacherTBD: 'Being assigned',
    duration: 'Duration',
    minutes: 'minutes',
    countdown: 'In',
    joinRoom: 'Enter classroom',
    reschedule: 'Reschedule',
    stats: {
      available: 'Available',
      availableSub: 'in your plan',
      scheduled: 'Scheduled',
      scheduledSub: 'upcoming',
      completed: 'Completed',
      completedSub: 'all-time',
      totalTime: 'Total time',
      totalTimeSub: 'hours of study',
    },
    upcoming: 'Your upcoming classes',
    upcomingKicker: 'Upcoming',
    viewAll: 'See all →',
    noUpcoming: 'No classes scheduled.',
    noUpcomingSub: 'Book your first class with your teacher.',
    bookNow: 'Schedule a class',
    teacherBeingAssigned: 'Teacher being assigned',
    awaitingTeacherSubtext: "We'll match you within 24 hours and email when confirmed.",
    today: 'Today',
    tomorrow: 'Tomorrow',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusAwaitingTeacher: 'Assigning',
    statusLive: 'Live',
    teacherCardKicker: 'Your assigned teacher',
    quickActionsKicker: 'Quick actions',
    actions: {
      book: { title: 'Schedule another class', sub: 'Pick any time that works for you' },
      test: { title: 'Placement call', sub: 'Find your exact level' },
      testScheduled: { title: 'View diagnostic call', sub: 'See your scheduled session' },
      progress: { title: 'My progress', sub: 'Track your improvement' },
    },
    placementBanner: {
      title: 'Schedule your free evaluation call',
      sub: "Not sure of your level? Let's figure it out together. Free, no pressure.",
      cta: 'Get started',
    },
    placementScheduledBanner: {
      title: 'Your diagnostic call is scheduled',
      with: (name: string) => `With ${name}`,
      hostPending: 'Host being assigned',
      cta: 'View',
    },
    placementPastBanner: {
      title: 'Your diagnostic call has passed',
      sub: (date: string) => `It was scheduled for ${date}. Reschedule to pick a new time.`,
      cta: 'Reschedule',
    },
    upgrade: 'Get more classes',
    noClassesBanner: "You've used all your classes. Get a new pack to keep learning.",
    allBookedBanner: 'Your plan is fully scheduled. Add more classes anytime.',
    firstPlanBanner: 'Get your first plan to start learning.',
    firstPlanCta: 'See plans',
  },
  es: {
    greeting: 'buenos días',
    greetingAfternoon: 'buenas tardes',
    greetingEvening: 'buenas noches',
    subtitleSuffix: '· Aquí está tu día',
    classesAvailable: (n: number) => `${n} clase${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}`,
    addClass: '+ Agendar clase',
    nextClass: 'Próxima clase',
    yourTeacher: 'Tu maestro',
    teacherTBD: 'Por asignar',
    duration: 'Duración',
    minutes: 'minutos',
    countdown: 'En',
    joinRoom: 'Entrar al salón',
    reschedule: 'Reagendar',
    stats: {
      available: 'Disponibles',
      availableSub: 'en tu plan',
      scheduled: 'Agendadas',
      scheduledSub: 'próximas',
      completed: 'Completadas',
      completedSub: 'históricas',
      totalTime: 'Tiempo total',
      totalTimeSub: 'horas de estudio',
    },
    upcoming: 'Tus próximas clases',
    upcomingKicker: 'Próximas',
    viewAll: 'Ver todas →',
    noUpcoming: 'No tienes clases agendadas.',
    noUpcomingSub: 'Agenda tu primera clase con tu maestro.',
    bookNow: 'Agendar clase',
    teacherBeingAssigned: 'Maestro por asignar',
    awaitingTeacherSubtext: 'Te asignamos un maestro en menos de 24h y te avisamos por correo.',
    today: 'Hoy',
    tomorrow: 'Mañana',
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusAwaitingTeacher: 'Asignando',
    statusLive: 'En vivo',
    teacherCardKicker: 'Tu maestro asignado',
    quickActionsKicker: 'Accesos rápidos',
    actions: {
      book: { title: 'Agendar otra clase', sub: 'Elige la hora que te funcione' },
      test: { title: 'Llamada de nivel', sub: 'Encuentra tu nivel exacto' },
      testScheduled: { title: 'Ver llamada diagnóstica', sub: 'Ver tu sesión agendada' },
      progress: { title: 'Mi progreso', sub: 'Sigue tu mejora' },
    },
    placementBanner: {
      title: 'Agenda tu llamada de diagnóstico gratuita',
      sub: '¿No sabes tu nivel? Lo descubrimos juntos. Gratis, sin presión.',
      cta: 'Comenzar',
    },
    placementScheduledBanner: {
      title: 'Tu llamada diagnóstica está agendada',
      with: (name: string) => `Con ${name}`,
      hostPending: 'Anfitrión por asignar',
      cta: 'Ver',
    },
    placementPastBanner: {
      title: 'Tu llamada diagnóstica ya pasó',
      sub: (date: string) => `Estaba agendada para el ${date}. Reagenda para elegir un nuevo horario.`,
      cta: 'Reagendar',
    },
    upgrade: 'Obtener más clases',
    noClassesBanner: 'Ya tomaste todas tus clases. Obtén un nuevo pack para seguir aprendiendo.',
    allBookedBanner: 'Tu plan está completo. Puedes añadir más clases en cualquier momento.',
    firstPlanBanner: 'Adquiere tu primer plan para comenzar a aprender.',
    firstPlanCta: 'Ver planes',
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

function ymdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  })
}

function formatTime(iso: string, lang: 'es' | 'en', timeZone: string) {
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

function dayInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(new Date(iso))
}

function weekdayShort(iso: string, lang: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'short',
    timeZone,
  })
    .format(new Date(iso))
    .toUpperCase()
    .replace(/\./g, '')
}

function monthShort(iso: string, lang: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-HN' : 'en-US', {
    month: 'short',
    timeZone,
  })
    .format(new Date(iso))
    .toUpperCase()
    .replace(/\./g, '')
}

function countdownText(iso: string, lang: Locale): string | null {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return lang === 'es' ? `${days}d ${hours % 24}h` : `${days}d ${hours % 24}h`
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
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
  placementConductorName?: string | null
  primaryTeacherName?: string | null
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
  placementConductorName,
  primaryTeacherName,
  completedSessions,
  scheduledClasses,
  upcomingBookings,
}: Props) {
  const tx = t[lang]
  const firstName = userName.split(' ')[0]
  const accent = 'var(--ek-red)'

  // Tick once a minute so the "Live" badge flips when a session starts/ends
  // without needing a full page reload. Hydration-safe: null on SSR.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tt = setTimeout(() => setNow(Date.now()), 0)
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      clearTimeout(tt)
      clearInterval(id)
    }
  }, [])

  const nextBooking = upcomingBookings[0]
  const nextTeacher =
    (nextBooking?.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name || null
  const nextHero = nextBooking
    ? {
        date: nextBooking.scheduled_at,
        teacher: nextTeacher,
        duration: nextBooking.duration_minutes,
      }
    : null

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <style>{`
        .ek-hero-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
          align-items: center;
        }
        .ek-hero-meta { gap: 28px; }
        .ek-upcoming-row {
          display: grid;
          grid-template-columns: 64px 1fr auto;
          gap: 16px;
          align-items: center;
        }
        @media (max-width: 640px) {
          .ek-hero-grid { grid-template-columns: 1fr; gap: 18px; }
          .ek-hero-meta { gap: 16px; }
        }
        @media (max-width: 480px) {
          .ek-upcoming-row {
            grid-template-columns: 56px 1fr;
            gap: 12px;
          }
          .ek-upcoming-actions {
            grid-column: 1 / -1;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
            align-items: center;
          }
        }
      `}</style>
      <DashTopBar
        title={
          <span>
            {lang === 'es' ? 'Hola, ' : 'Hi, '}
            {firstName}
            {' — '}
            <TitleFlourish>{getGreeting(lang, timezone)}</TitleFlourish>
          </span>
        }
        sub={`${timezone.split('/').pop()?.replace('_', ' ') ?? ''} ${tx.subtitleSuffix}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: 15, fontWeight: 700, color: accent, fontFeatureSettings: '"tnum"' }}>
                {classesRemaining}
              </span>
              {lang === 'es' ? 'clases disponibles' : 'classes available'}
            </span>
            <Link
              href={`/${lang}/dashboard/agendar`}
              className="ek-btn ek-btn-primary ek-btn-square"
              style={{ padding: '9px 16px', fontSize: 12 }}
            >
              {tx.addClass}
            </Link>
          </div>
        }
      />

      <div style={{ padding: '24px clamp(16px, 4vw, 36px)', maxWidth: 1280, margin: '0 auto' }}>
        {/* Banners — all conditional, preserve every existing state */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {!placementTestDone && !placementScheduled && (
            <BannerCard
              tone="red"
              title={tx.placementBanner.title}
              sub={tx.placementBanner.sub}
              cta={tx.placementBanner.cta}
              href={`/${lang}/dashboard/placement`}
            />
          )}

          {!placementTestDone &&
            placementScheduled &&
            (() => {
              // "Past" only after the live window closes (scheduled + duration + 90-min late cap)
              const PLACEMENT_LIVE_WINDOW_MS = (60 + 90) * 60_000
              const isPast =
                placementScheduledAt && now !== null
                  ? now > new Date(placementScheduledAt).getTime() + PLACEMENT_LIVE_WINDOW_MS
                  : false
              const formattedDate = placementScheduledAt
                ? new Date(placementScheduledAt).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                    timeZone: 'America/Tegucigalpa',
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''

              if (isPast) {
                return (
                  <BannerCard
                    tone="warn"
                    title={tx.placementPastBanner.title}
                    sub={tx.placementPastBanner.sub(formattedDate)}
                    cta={tx.placementPastBanner.cta}
                    href={`/${lang}/dashboard/placement?reschedule=1`}
                  />
                )
              }

              return (
                <BannerCard
                  tone="success"
                  title={tx.placementScheduledBanner.title}
                  sub={
                    placementConductorName
                      ? tx.placementScheduledBanner.with(placementConductorName)
                      : tx.placementScheduledBanner.hostPending
                  }
                  cta={tx.placementScheduledBanner.cta}
                  href={`/${lang}/dashboard/placement`}
                />
              )
            })()}

          {classesRemaining === 0 && !currentPlan && completedSessions === 0 && (
            <BannerCard
              tone="neutral"
              title={tx.firstPlanBanner}
              cta={tx.firstPlanCta}
              href={`/${lang}/dashboard/plan`}
            />
          )}

          {classesRemaining === 0 &&
            scheduledClasses === 0 &&
            (currentPlan !== null || completedSessions > 0) && (
              <BannerCard
                tone="warn"
                title={tx.noClassesBanner}
                cta={tx.upgrade}
                href={`/${lang}/dashboard/plan`}
              />
            )}

          {classesRemaining === 0 && scheduledClasses > 0 && (
            <BannerCard
              tone="neutral"
              title={tx.allBookedBanner}
              cta={tx.upgrade}
              href={`/${lang}/dashboard/plan`}
            />
          )}

          {primaryTeacherName && (
            <div
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--ek-ink)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                {primaryTeacherName
                  .split(' ')
                  .map((s) => s[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-text-muted)',
                  }}
                >
                  {tx.teacherCardKicker}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 2,
                    color: 'var(--ek-text)',
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                >
                  {primaryTeacherName}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Next class dark hero — only when a booking exists */}
        {nextHero && (
          <div style={{ marginBottom: 24 }}>
            <DarkHeroCard
              ghost={countdownText(nextHero.date, lang) ?? ''}
              ghostSize={220}
              padding="28px 32px"
            >
              <div className="ek-hero-grid">
                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ek-on-dark-muted)',
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
                    {tx.nextClass}
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 'clamp(2rem, 3.2vw, 2.75rem)',
                      fontWeight: 800,
                      letterSpacing: '-0.035em',
                      lineHeight: 1.0,
                      color: 'var(--ek-on-dark)',
                    }}
                  >
                    {formatDate(nextHero.date, lang, timezone)}, {formatTime(nextHero.date, lang, timezone)}
                  </h2>
                  <div
                    className="ek-hero-meta"
                    style={{
                      display: 'flex',
                      marginTop: 18,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #C41E3A, #8B1529)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(nextHero.teacher || '?')
                          .split(' ')
                          .map((s) => s[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--ek-on-dark-muted)',
                            letterSpacing: 1.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          {tx.yourTeacher}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ek-on-dark)',
                            marginTop: 1,
                            fontStyle: nextHero.teacher ? 'normal' : 'italic',
                          }}
                        >
                          {nextHero.teacher || tx.teacherTBD}
                        </div>
                      </div>
                    </div>
                    <div style={{ width: 1, height: 32, background: 'var(--ek-on-dark-faint)' }} />
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--ek-on-dark-muted)',
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {tx.duration}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ek-on-dark)',
                          marginTop: 1,
                        }}
                      >
                        {nextHero.duration} {tx.minutes}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
                  <JoinSessionButton
                    lang={lang}
                    bookingId={nextBooking!.id}
                    scheduledAt={nextHero.date}
                  />
                  <Link
                    href={`/${lang}/dashboard/clases`}
                    style={{
                      background: 'transparent',
                      color: 'var(--ek-on-dark-soft)',
                      border: '1px solid var(--ek-on-dark-faint)',
                      padding: '10px 22px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    {tx.reschedule}
                  </Link>
                </div>
              </div>
            </DarkHeroCard>
          </div>
        )}

        {/* Stats — editorial ledger: big numbers + hairline rules, no boxes.
            Each stat is a doorway to its section (the one useful idea from the
            21st inspiration; the rest discarded as generic 'AI card' styling). */}
        <div style={{ marginBottom: 28 }}>
          <div className="ek-microlabel" style={{ color: 'var(--ek-red)', marginBottom: 12 }}>
            {lang === 'es' ? 'De un vistazo' : 'At a glance'}
          </div>
          <StatLedger
            items={[
              { kicker: tx.stats.available, value: classesRemaining, sub: tx.stats.availableSub, href: `/${lang}/dashboard/plan`, accent: true },
              { kicker: tx.stats.scheduled, value: scheduledClasses, sub: tx.stats.scheduledSub, href: `/${lang}/dashboard/clases` },
              { kicker: tx.stats.completed, value: completedSessions, sub: tx.stats.completedSub, href: `/${lang}/dashboard/progreso` },
              { kicker: tx.stats.totalTime, value: `${completedSessions}h`, sub: tx.stats.totalTimeSub, href: `/${lang}/dashboard/progreso` },
            ]}
          />
        </div>

        {/* Upcoming + Quick Actions */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
          style={{
            gap: 20,
          }}
        >
          {/* Upcoming list */}
          <section
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                padding: '18px 22px 14px',
                borderBottom: '1px solid var(--ek-border-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-text-muted)',
                    fontWeight: 700,
                  }}
                >
                  {tx.upcomingKicker}
                </div>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--ek-text)',
                  }}
                >
                  {tx.upcoming}
                </h3>
              </div>
              <Link
                href={`/${lang}/dashboard/clases`}
                style={{
                  fontSize: 12,
                  color: 'var(--ek-text-muted)',
                  textDecoration: 'none',
                }}
              >
                {tx.viewAll}
              </Link>
            </header>

            {upcomingBookings.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--ek-text)',
                  }}
                >
                  {tx.noUpcoming}
                </p>
                <p
                  style={{
                    margin: '6px 0 20px',
                    fontSize: 12,
                    color: 'var(--ek-text-muted)',
                  }}
                >
                  {tx.noUpcomingSub}
                </p>
                <Link
                  href={`/${lang}/dashboard/agendar`}
                  className="ek-btn ek-btn-red ek-btn-square"
                  style={{ padding: '10px 22px', fontSize: 13 }}
                >
                  {tx.bookNow} →
                </Link>
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {upcomingBookings.map((booking) => {
                  const teacherName =
                    (booking.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name ||
                    null
                  const awaitingTeacher = !teacherName && booking.status === 'pending'
                  const startMs = new Date(booking.scheduled_at).getTime()
                  const endMs = startMs + (booking.duration_minutes || 60) * 60_000
                  const isLive = now !== null && now >= startMs && now <= endMs

                  return (
                    <li
                      key={booking.id}
                      className="ek-upcoming-row"
                      style={{
                        padding: '18px 22px',
                        borderBottom: '1px solid var(--ek-border-soft)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'var(--ek-text-muted)',
                            fontFamily: 'var(--ek-font-mono)',
                          }}
                        >
                          {weekdayShort(booking.scheduled_at, lang, timezone)}
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: 'var(--ek-text)',
                            letterSpacing: '-0.025em',
                            lineHeight: 1,
                            marginTop: 2,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {dayInTz(booking.scheduled_at, timezone)}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'var(--ek-text-muted)',
                            marginTop: 2,
                          }}
                        >
                          {monthShort(booking.scheduled_at, lang, timezone)}
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: awaitingTeacher ? 'var(--ek-text-muted)' : 'var(--ek-text)',
                            fontStyle: awaitingTeacher ? 'italic' : 'normal',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {awaitingTeacher
                            ? tx.teacherBeingAssigned
                            : `${lang === 'es' ? 'Clase con' : 'Class with'} ${teacherName}`}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--ek-text-muted)',
                            marginTop: 3,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes} {tx.minutes}
                        </div>
                      </div>

                      <div
                        className="ek-upcoming-actions"
                        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <StatusBadge
                          variant={
                            isLive
                              ? 'cancelled' /* red live */
                              : booking.status === 'confirmed'
                                ? 'confirmed'
                                : awaitingTeacher
                                  ? 'pending'
                                  : 'neutral'
                          }
                        >
                          {isLive
                            ? tx.statusLive
                            : booking.status === 'confirmed'
                              ? tx.statusConfirmed
                              : awaitingTeacher
                                ? tx.statusAwaitingTeacher
                                : tx.statusPending}
                        </StatusBadge>

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
          </section>

          {/* Quick actions */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                padding: '0 4px',
              }}
            >
              {tx.quickActionsKicker}
            </div>
            <QuickAction
              href={`/${lang}/dashboard/agendar`}
              title={tx.actions.book.title}
              sub={tx.actions.book.sub}
              accent={accent}
            />
            {!placementTestDone && (
              <QuickAction
                href={`/${lang}/dashboard/placement`}
                title={placementScheduled ? tx.actions.testScheduled.title : tx.actions.test.title}
                sub={placementScheduled ? tx.actions.testScheduled.sub : tx.actions.test.sub}
                accent={accent}
              />
            )}
            <QuickAction
              href={`/${lang}/dashboard/progreso`}
              title={tx.actions.progress.title}
              sub={tx.actions.progress.sub}
              accent={accent}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

function BannerCard({
  tone,
  title,
  sub,
  cta,
  href,
}: {
  tone: 'red' | 'success' | 'warn' | 'neutral'
  title: string
  sub?: string
  cta?: string
  href?: string
}) {
  const palette = {
    red: {
      bg: 'var(--ek-card)',
      border: 'var(--ek-red-tint-3)',
      dotBg: 'var(--ek-red-tint)',
      dotColor: 'var(--ek-red)',
      btnBg: 'var(--ek-red)',
      btnColor: '#fff',
    },
    success: {
      bg: 'var(--ek-card)',
      border: 'var(--ek-success-border)',
      dotBg: 'var(--ek-success-bg)',
      dotColor: 'var(--ek-success-text)',
      btnBg: 'var(--ek-success-text)',
      btnColor: '#fff',
    },
    warn: {
      bg: 'var(--ek-warn-bg)',
      border: 'var(--ek-warn-border)',
      dotBg: '#FEF3C7',
      dotColor: 'var(--ek-warn-text)',
      btnBg: 'var(--ek-warn-text)',
      btnColor: '#fff',
    },
    neutral: {
      bg: 'var(--ek-card)',
      border: 'var(--ek-border)',
      dotBg: 'var(--ek-paper-deep)',
      dotColor: 'var(--ek-text-muted)',
      btnBg: 'var(--ek-ink)',
      btnColor: '#fff',
    },
  }[tone]

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 3,
          alignSelf: 'stretch',
          minHeight: 34,
          borderRadius: 2,
          background: palette.dotColor,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
        )}
      </div>
      {cta && href && (
        <Link
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 8,
            background: palette.btnBg,
            color: palette.btnColor,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {cta} →
        </Link>
      )}
    </div>
  )
}

function QuickAction({
  href,
  title,
  sub,
  accent,
}: {
  href: string
  title: string
  sub: string
  accent: string
}) {
  return (
    <Link
      href={href}
      style={{
        background: 'var(--ek-card)',
        border: '1px solid var(--ek-border)',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 3,
          alignSelf: 'stretch',
          minHeight: 30,
          borderRadius: 2,
          background: accent,
          opacity: 0.85,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ek-text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--ek-text-faint)', fontSize: 16 }}>›</span>
    </Link>
  )
}
