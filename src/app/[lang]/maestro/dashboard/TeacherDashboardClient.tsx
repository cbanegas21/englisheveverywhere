'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SectionHeader } from '@/components/dashboard/SectionHeader'

const t = {
  en: {
    greeting: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    subtitle: 'Your teaching overview for today.',
    activeToggle: 'Accepting students',
    inactiveToggle: 'Paused',
    acceptingKicker: 'New bookings',
    acceptingOnHint: 'On — open to new student bookings.',
    acceptingOffHint: 'Off — new student bookings are paused. Your current classes are unaffected.',
    stats: {
      sessions: 'Sessions this month',
      sessionsSub: 'completed',
      total: 'Total sessions',
      totalSub: 'all-time',
      rating: 'Your rating',
      ratingSub: 'out of 5',
    },
    upcoming: 'Upcoming sessions',
    upcomingKicker: 'Schedule',
    noUpcoming: 'No upcoming sessions scheduled.',
    noUpcomingSub: 'Set your availability to start receiving bookings.',
    setAvailability: 'Set availability',
    with: 'with',
    student: 'Student',
    mins: 'min',
    viewAll: 'View schedule →',
    quickActions: 'Quick actions',
    quickActionsKicker: 'Shortcuts',
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
    inactiveToggle: 'En pausa',
    acceptingKicker: 'Nuevas reservas',
    acceptingOnHint: 'Activo — abierto a reservas de nuevos estudiantes.',
    acceptingOffHint: 'En pausa — no recibirás reservas de nuevos estudiantes. Tus clases actuales no se ven afectadas.',
    stats: {
      sessions: 'Sesiones este mes',
      sessionsSub: 'completadas',
      total: 'Total de sesiones',
      totalSub: 'históricas',
      rating: 'Tu calificación',
      ratingSub: 'sobre 5',
    },
    upcoming: 'Próximas sesiones',
    upcomingKicker: 'Agenda',
    noUpcoming: 'No tienes sesiones próximas.',
    noUpcomingSub: 'Define tu disponibilidad para comenzar a recibir reservas.',
    setAvailability: 'Definir disponibilidad',
    with: 'con',
    student: 'Estudiante',
    mins: 'min',
    viewAll: 'Ver agenda →',
    quickActions: 'Acciones rápidas',
    quickActionsKicker: 'Atajos',
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

function formatTime(iso: string, lang: 'es' | 'en', timeZone: string) {
  // Pin locale + tz to keep SSR + client output identical (hydration-safe).
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', timeZone,
  })
}

function dayInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(new Date(iso))
}

function weekdayShort(iso: string, lang: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-HN' : 'en-US', { weekday: 'short', timeZone })
    .format(new Date(iso))
    .toUpperCase()
    .replace(/\./g, '')
}

function monthShort(iso: string, lang: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-HN' : 'en-US', { month: 'short', timeZone })
    .format(new Date(iso))
    .toUpperCase()
    .replace(/\./g, '')
}

// Supabase nested one-to-one selects can resolve as either an object or a
// single-element array depending on inferred cardinality. Unwrap both shapes
// so the real student name survives instead of silently falling back to the
// generic label. (Opportunistic fix — preserves the existing fallback.)
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function studentName(session: Session): string | null {
  const student = unwrap(session.student as
    | { profile?: { full_name?: string } | { full_name?: string }[] | null }
    | { profile?: { full_name?: string } | { full_name?: string }[] | null }[]
    | null)
  const profile = unwrap(student?.profile)
  return profile?.full_name || null
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
  accepting: boolean
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
  accepting: initialActive,
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
    const tt = setTimeout(() => setNowTick(Date.now()), 0)
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => { clearTimeout(tt); clearInterval(id) }
  }, [])
  const [isPending, startTransition] = useTransition()

  // Teacher's "accepting new students" preference. Decoupled from is_active
  // (admin approval) so toggling it can never lock the teacher out of their
  // dashboard. See migration 028 / audit EK-011.
  function toggleActive() {
    const supabase = createClient()
    startTransition(async () => {
      await supabase
        .from('teachers')
        .update({ accepting_students: !active })
        .eq('profile_id', profileId)
      setActive(!active)
    })
  }

  const quickActions = [
    tx.actions.availability,
    tx.actions.students,
    tx.actions.sessions,
  ]

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      <DashTopBar
        title={
          <span>
            {getGreeting(lang)}, {firstName}
            {' — '}
            <TitleFlourish>{tx.subtitle.replace(/\.$/, '')}</TitleFlourish>
          </span>
        }
        right={
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 5,
            }}
          >
            <button
              onClick={toggleActive}
              disabled={isPending}
              className="ek-quickrow"
              aria-pressed={active}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 9,
                padding: '8px 14px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--ek-font-sans)',
                border: `1px solid ${active ? 'var(--ek-red)' : 'var(--ek-border-mid)'}`,
                background: 'var(--ek-card)',
                color: 'var(--ek-text-soft)',
                opacity: isPending ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                }}
              >
                {tx.acceptingKicker}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: active ? 'var(--ek-red)' : 'var(--ek-text-muted)',
                }}
              >
                {active ? tx.activeToggle : tx.inactiveToggle}
              </span>
            </button>
            {/* Honest one-line explainer: OFF genuinely pauses new bookings;
                current classes are unaffected (gated admin-side). See TE-01. */}
            <span
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                color: 'var(--ek-text-muted)',
                fontStyle: 'italic',
                fontFamily: 'var(--ek-font-serif)',
                maxWidth: 280,
                textAlign: 'right',
              }}
            >
              {active ? tx.acceptingOnHint : tx.acceptingOffHint}
            </span>
          </div>
        }
      />

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-7">

        {/* Specializations — squared hairline chips, no pills */}
        {specializations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span
              className="ek-microlabel"
              style={{ flexShrink: 0 }}
            >
              {tx.specs}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {specializations.slice(0, 5).map(s => (
                <span
                  key={s}
                  style={{
                    fontSize: 11,
                    padding: '4px 9px',
                    borderRadius: 4,
                    fontWeight: 500,
                    background: 'var(--ek-paper-deep)',
                    color: 'var(--ek-text-soft)',
                    border: '1px solid var(--ek-border)',
                  }}
                >
                  {s}
                </span>
              ))}
              {specializations.length > 5 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '4px 9px',
                    borderRadius: 4,
                    background: 'var(--ek-paper-deep)',
                    color: 'var(--ek-text-muted)',
                    border: '1px solid var(--ek-border)',
                  }}
                >
                  +{specializations.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats — editorial ledger: big numbers + hairline rules, no boxes.
            Rating is the key signal, marked accent. Mirrors the student
            dashboard ledger. */}
        <div>
          <div className="ek-microlabel" style={{ color: 'var(--ek-red)', marginBottom: 12 }}>
            {lang === 'es' ? 'De un vistazo' : 'At a glance'}
          </div>
          <StatLedger
            items={[
              { kicker: tx.stats.sessions, value: thisMonthSessions, sub: tx.stats.sessionsSub },
              { kicker: tx.stats.total, value: totalSessions, sub: tx.stats.totalSub },
              { kicker: tx.stats.rating, value: rating > 0 ? rating.toFixed(1) : '—', sub: tx.stats.ratingSub, accent: true },
            ]}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5" style={{ gap: 28 }}>

          {/* Upcoming sessions — left 3/5 */}
          <section className="lg:col-span-3">
            <style>{`
              .ek-tsess-row { display: grid; grid-template-columns: 56px 1fr auto; gap: 16px; align-items: center; }
              .ek-tsess-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
              @media (max-width: 560px) {
                .ek-tsess-row { grid-template-columns: 48px 1fr; }
                .ek-tsess-actions { grid-column: 1 / -1; justify-content: flex-start; padding-left: 60px; }
              }
            `}</style>
            <SectionHeader
              kicker={tx.upcomingKicker}
              title={tx.upcoming}
              right={
                <Link
                  href={`/${lang}/maestro/dashboard/agenda`}
                  className="ek-link-muted"
                  style={{ fontSize: 12 }}
                >
                  {tx.viewAll}
                </Link>
              }
            />

            {upcomingSessions.length === 0 ? (
              <div style={{ padding: '40px 4px' }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                    fontSize: 19,
                    color: 'var(--ek-text-soft)',
                  }}
                >
                  {tx.noUpcoming}
                </p>
                <p style={{ margin: '8px 0 20px', fontSize: 13, color: 'var(--ek-text-muted)' }}>
                  {tx.noUpcomingSub}
                </p>
                <Link
                  href={`/${lang}/maestro/dashboard/disponibilidad`}
                  className="ek-red-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '10px 20px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 13,
                    background: 'var(--ek-red)',
                    color: '#fff',
                    textDecoration: 'none',
                  }}
                >
                  {tx.setAvailability}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {upcomingSessions.map((session) => {
                  const startMs = new Date(session.scheduled_at).getTime()
                  const endMs = startMs + (session.duration_minutes || 60) * 60_000
                  const isLive = nowTick !== null && nowTick >= startMs && nowTick <= endMs
                  const name = studentName(session)
                  return (
                    <li
                      key={session.id}
                      className="ek-row ek-tsess-row"
                      style={{
                        padding: '16px 8px',
                        borderBottom: '1px solid var(--ek-border-soft)',
                      }}
                    >
                      <div className="ek-tsess-date" style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'var(--ek-text-muted)',
                            fontFamily: 'var(--ek-font-mono)',
                          }}
                        >
                          {weekdayShort(session.scheduled_at, lang, timezone)}
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
                          {dayInTz(session.scheduled_at, timezone)}
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
                          {monthShort(session.scheduled_at, lang, timezone)}
                        </div>
                      </div>

                      <div className="ek-tsess-main" style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--ek-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {tx.with} {name || tx.student}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--ek-text-muted)',
                            marginTop: 3,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {formatTime(session.scheduled_at, lang, timezone)} · {session.duration_minutes}{tx.mins}
                        </div>
                      </div>

                      <div className="ek-tsess-actions">
                        <StatusBadge
                          variant={isLive ? 'live' : session.status === 'confirmed' ? 'confirmed' : 'pending'}
                          dot={isLive}
                        >
                          {isLive ? tx.statusLive : session.status === 'confirmed' ? tx.statusConfirmed : tx.statusPending}
                        </StatusBadge>

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
          </section>

          {/* Quick actions — typographic hairline list, right 2/5 */}
          <aside className="lg:col-span-2">
            <SectionHeader kicker={tx.quickActionsKicker} title={tx.quickActions} />
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {quickActions.map(({ href, title, sub }) => (
                <li key={href}>
                  <Link
                    href={`/${lang}${href}`}
                    className="ek-quickrow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 14px',
                      borderBottom: '1px solid var(--ek-border-soft)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 2 }}>{sub}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ek-text-faint)' }} />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
