'use client'

import Link from 'next/link'
import { TrendingUp, BookOpen, Clock, Award, Calendar, User, Phone, CheckCircle2, ArrowRight } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { PRICING_MAP, type PricingPlanKey } from '@/lib/pricing'

// ─── CEFR ────────────────────────────────────────────────────────────────

const CEFR_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type CefrLevel = (typeof CEFR_LEVELS)[number]

const LEVEL_LABELS: Record<CefrLevel, { en: string; es: string }> = {
  A0: { en: 'Complete beginner',      es: 'Principiante completo' },
  A1: { en: 'Beginner',               es: 'Principiante' },
  A2: { en: 'Elementary',             es: 'Elemental' },
  B1: { en: 'Intermediate',           es: 'Intermedio' },
  B2: { en: 'Upper intermediate',     es: 'Intermedio alto' },
  C1: { en: 'Advanced',               es: 'Avanzado' },
  C2: { en: 'Mastery',                es: 'Maestría' },
}

// ─── Survey answer labels ────────────────────────────────────────────────

const GOAL_LABELS: Record<string, { en: string; es: string }> = {
  work:     { en: 'Work',           es: 'Trabajo' },
  travel:   { en: 'Travel',         es: 'Viajes' },
  studies:  { en: 'Studies',        es: 'Estudios' },
  growth:   { en: 'Personal growth',es: 'Crecimiento personal' },
  emigrate: { en: 'Move abroad',    es: 'Emigrar' },
  other:    { en: 'Other',          es: 'Otro' },
}

const PACE_LABELS: Record<string, { en: string; es: string }> = {
  relaxed:   { en: '1–2 classes/week',  es: '1-2 clases/semana' },
  steady:    { en: '3 classes/week',    es: '3 clases/semana' },
  intensive: { en: 'Every day',         es: 'Todos los días' },
}

const STYLE_LABELS: Record<string, { en: string; es: string }> = {
  listening: { en: 'Listening',  es: 'Escuchando' },
  reading:   { en: 'Reading',    es: 'Leyendo' },
  speaking:  { en: 'Speaking',   es: 'Hablando' },
  writing:   { en: 'Writing',    es: 'Escribiendo' },
  mixed:     { en: 'Mixed',      es: 'Combinado' },
}

// ─── Translations ─────────────────────────────────────────────────────────

const t = {
  en: {
    title: 'My Progress',
    subtitle: 'Your complete learning journey.',
    // Stats
    stats: {
      completed: 'Classes completed',
      hours: 'Hours learned',
      level: 'Current level',
      remaining: 'Classes remaining',
      upcoming: 'Upcoming classes',
      noLevel: 'Pending placement',
    },
    // Plan
    planTitle: 'Current plan',
    planNone: 'No active plan',
    planCta: 'Get your first plan',
    classesThisMonth: 'Classes this month',
    classesTotal: 'classes in pack',
    // Timeline
    timelineTitle: 'Learning timeline',
    timelineEmpty: 'Your learning journey starts here. Complete your first class to see your progress.',
    duration: (m: number) => `${m} min`,
    aiSummary: 'Session summary',
    noSummary: 'Summary will appear after class.',
    // Profile
    profileTitle: 'My learning profile',
    profileEmpty: 'Complete your placement test to see your learning profile.',
    profileCta: 'Take placement test',
    goals: 'Learning goals',
    pace: 'Preferred pace',
    style: 'Learning style',
    notes: 'Notes for teacher',
    // CEFR
    cefrLabel: 'CEFR level progression',
    noLevel: 'Not set yet',
    noLevelSub: 'Complete your placement test to get your level.',
    // Placement status
    placementTitle: 'Diagnostic call',
    placementNotScheduled: 'Schedule your free diagnostic call',
    placementNotScheduledSub: 'We\'ll assess your level and build your personalized learning plan.',
    placementNotScheduledCta: 'Schedule call',
    placementScheduledTitle: 'Diagnostic call scheduled',
    placementScheduledSub: (date: string) => `Your call is booked for ${date}.`,
    placementDoneTitle: 'Diagnostic completed',
    placementDoneSub: (level: string) => `Your level was assessed as ${level}.`,
  },
  es: {
    title: 'Mi Progreso',
    subtitle: 'Tu viaje de aprendizaje completo.',
    stats: {
      completed: 'Clases completadas',
      hours: 'Horas aprendidas',
      level: 'Nivel actual',
      remaining: 'Clases disponibles',
      upcoming: 'Clases próximas',
      noLevel: 'Pendiente de diagnóstico',
    },
    planTitle: 'Plan actual',
    planNone: 'Sin plan activo',
    planCta: 'Obtén tu primer plan',
    classesThisMonth: 'Clases este mes',
    classesTotal: 'clases en el pack',
    timelineTitle: 'Historial de clases',
    timelineEmpty: 'Tu viaje empieza aquí. Completa tu primera clase para ver tu progreso.',
    duration: (m: number) => `${m} min`,
    aiSummary: 'Resumen de sesión',
    noSummary: 'El resumen aparecerá después de la clase.',
    profileTitle: 'Mi perfil de aprendizaje',
    profileEmpty: 'Completa tu diagnóstico para ver tu perfil.',
    profileCta: 'Hacer diagnóstico',
    goals: 'Objetivos',
    pace: 'Ritmo preferido',
    style: 'Estilo de aprendizaje',
    notes: 'Notas para la maestra',
    cefrLabel: 'Progresión de nivel CEFR',
    noLevel: 'Aún no establecido',
    noLevelSub: 'Completa tu diagnóstico para conocer tu nivel.',
    // Placement status
    placementTitle: 'Llamada diagnóstica',
    placementNotScheduled: 'Agenda tu llamada diagnóstica gratuita',
    placementNotScheduledSub: 'Evaluaremos tu nivel y crearemos tu plan de aprendizaje personalizado.',
    placementNotScheduledCta: 'Agendar llamada',
    placementScheduledTitle: 'Llamada diagnóstica agendada',
    placementScheduledSub: (date: string) => `Tu llamada está agendada para el ${date}.`,
    placementDoneTitle: 'Diagnóstico completado',
    placementDoneSub: (level: string) => `Tu nivel fue evaluado como ${level}.`,
  },
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  lang: Locale
  level: string | null
  classesRemaining: number
  currentPlan: string | null
  surveyAnswers: Record<string, unknown> | null
  placementTestDone: boolean
  placementScheduled: boolean
  placementBookingAt: string | null
  completedTotal: number
  completedThisMonth: number
  upcomingClasses: number
  recentBookings: {
    id: string
    scheduled_at: string
    duration_minutes: number
    notes?: unknown
  }[]
}

function fmtDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ProgresoClient({
  lang, level, classesRemaining, currentPlan, surveyAnswers,
  placementTestDone, placementScheduled, placementBookingAt,
  completedTotal, completedThisMonth, upcomingClasses, recentBookings,
}: Props) {
  const tx = t[lang]
  const activeIndex = level ? CEFR_LEVELS.indexOf(level as CefrLevel) : -1
  const planInfo = currentPlan ? PRICING_MAP[currentPlan as PricingPlanKey] : null
  const planTotal = planInfo?.classes ?? 0
  const planProgress = planTotal > 0 ? Math.min(100, (completedThisMonth / planTotal) * 100) : 0
  const hoursLearned = completedTotal // 1 class ≈ 1 hour

  // ── Stats row ─────────────────────────────────────────────────

  const stats = [
    {
      label: tx.stats.completed,
      value: completedTotal,
      icon: BookOpen,
    },
    {
      label: tx.stats.upcoming,
      value: upcomingClasses,
      icon: Calendar,
    },
    {
      label: level ? tx.stats.level : tx.stats.noLevel,
      value: level || '—',
      icon: TrendingUp,
      accent: !level,
    },
    {
      label: tx.stats.remaining,
      value: classesRemaining,
      icon: Award,
      urgent: classesRemaining === 0,
    },
  ]

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto space-y-5">

        {/* ── Section 1: Stats row ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, urgent, accent }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded mb-3"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <Icon className="h-4 w-4" style={{ color: '#C41E3A' }} />
              </div>
              <div
                className="text-[26px] font-black"
                style={{ color: urgent ? '#DC2626' : accent ? '#9CA3AF' : '#111111' }}
              >
                {value}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Placement status card ─────────────────────────── */}
        {(() => {
          const placementDate = placementBookingAt
            ? new Date(placementBookingAt).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : null

          if (placementTestDone) {
            return (
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                  style={{ background: '#DCFCE7' }}
                >
                  <CheckCircle2 className="h-5 w-5" style={{ color: '#16A34A' }} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold" style={{ color: '#15803D' }}>{tx.placementDoneTitle}</p>
                  {level && (
                    <p className="text-[12px] mt-0.5" style={{ color: '#16A34A' }}>
                      {tx.placementDoneSub(level)}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded flex-shrink-0"
                  style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #86EFAC' }}
                >
                  {level || '—'}
                </span>
              </div>
            )
          }

          if (placementScheduled) {
            return (
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: '#EFF6FF', border: '1px solid #93C5FD' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                  style={{ background: '#DBEAFE' }}
                >
                  <Phone className="h-5 w-5" style={{ color: '#2563EB' }} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold" style={{ color: '#1D4ED8' }}>{tx.placementScheduledTitle} ✓</p>
                  {placementDate && (
                    <p className="text-[12px] mt-0.5" style={{ color: '#3B82F6' }}>
                      {tx.placementScheduledSub(placementDate)}
                    </p>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <Phone className="h-5 w-5" style={{ color: '#C41E3A' }} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.placementNotScheduled}</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.placementNotScheduledSub}</p>
              </div>
              <Link
                href={`/${lang}/dashboard/placement`}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all whitespace-nowrap"
                style={{ background: '#C41E3A', color: '#fff' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
              >
                {tx.placementNotScheduledCta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )
        })()}

        {/* ── Section 2: CEFR level + plan ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CEFR */}
          <div className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: 'rgba(196,30,58,0.08)' }}>
                <TrendingUp className="h-4 w-4" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {tx.cefrLabel}
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded text-[22px] font-black flex-shrink-0"
                style={level ? { background: '#C41E3A', color: '#fff' } : { background: '#F3F4F6', color: '#9CA3AF' }}
              >
                {level || '?'}
              </div>
              <div>
                {level ? (
                  <p className="text-[14px] font-bold" style={{ color: '#111111' }}>
                    {LEVEL_LABELS[level as CefrLevel]?.[lang] || level}
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>{tx.noLevel}</p>
                    <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.noLevelSub}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {CEFR_LEVELS.map((lvl, i) => {
                const isActive = i === activeIndex
                const isPast = i < activeIndex
                return (
                  <div key={lvl} className="flex items-center gap-1 flex-1">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold flex-shrink-0"
                      style={
                        isActive
                          ? { background: '#C41E3A', color: '#fff', boxShadow: '0 0 0 2px rgba(196,30,58,0.2)' }
                          : isPast
                          ? { background: '#C41E3A', color: '#fff', opacity: 0.35 }
                          : { background: '#F3F4F6', color: '#9CA3AF' }
                      }
                    >
                      {lvl}
                    </div>
                    {i < CEFR_LEVELS.length - 1 && (
                      <div className="h-0.5 flex-1" style={{ background: isPast ? 'rgba(196,30,58,0.35)' : '#F3F4F6' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Current plan */}
          <div className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: 'rgba(196,30,58,0.08)' }}>
                <Award className="h-4 w-4" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {tx.planTitle}
              </p>
            </div>

            {planInfo ? (
              <>
                <p className="text-[18px] font-black mb-1" style={{ color: '#111111' }}>{planInfo.name}</p>
                <p className="text-[12px] mb-4" style={{ color: '#9CA3AF' }}>
                  {planTotal} {tx.classesTotal}
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>{tx.classesThisMonth}</p>
                    <p className="text-[11px] font-bold" style={{ color: '#111111' }}>
                      {completedThisMonth}/{planTotal}
                    </p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${planProgress}%`, background: '#C41E3A' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold mb-3" style={{ color: '#9CA3AF' }}>{tx.planNone}</p>
                <Link
                  href={`/${lang}/dashboard/plan`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-[12px] font-bold transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                >
                  {tx.planCta}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Section 3: Learning timeline ──────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            <Calendar className="h-4 w-4" style={{ color: '#C41E3A' }} />
            <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.timelineTitle}</h2>
          </div>

          {recentBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-3" style={{ background: '#F3F4F6' }}>
                <Calendar className="h-5 w-5" style={{ color: '#9CA3AF' }} />
              </div>
              <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                {tx.timelineEmpty}
              </p>
            </div>
          ) : (
            <ul>
              {recentBookings.map((booking, i) => {
                const notes = booking.notes as { covered?: string; nextTopics?: string } | null
                return (
                  <li
                    key={booking.id}
                    className="px-5 py-4"
                    style={{ borderBottom: i < recentBookings.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Date badge */}
                      <div className="flex-shrink-0 text-center w-12">
                        <div className="text-[9px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                          {new Date(booking.scheduled_at).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { month: 'short' })}
                        </div>
                        <div className="text-[20px] font-black leading-none" style={{ color: '#C41E3A' }}>
                          {new Date(booking.scheduled_at).getDate()}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                            {fmtDate(booking.scheduled_at, lang)}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}>
                            {lang === 'es' ? 'Completada' : 'Completed'}
                          </span>
                        </div>
                        <p className="text-[11px] mb-2" style={{ color: '#9CA3AF' }}>
                          {fmtTime(booking.scheduled_at)} · {tx.duration(booking.duration_minutes || 60)}
                        </p>

                        {notes?.covered ? (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold" style={{ color: '#111111' }}>
                              {tx.aiSummary}:
                            </p>
                            <p className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>
                              {notes.covered}
                            </p>
                            {notes.nextTopics && (
                              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                                → {notes.nextTopics}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px]" style={{ color: '#E5E7EB' }}>{tx.noSummary}</p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ── Section 4: Learning profile ───────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            <User className="h-4 w-4" style={{ color: '#C41E3A' }} />
            <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.profileTitle}</h2>
          </div>

          {!surveyAnswers ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <p className="text-[13px] mb-4" style={{ color: '#9CA3AF' }}>{tx.profileEmpty}</p>
              {!placementTestDone && (
                <Link
                  href={`/${lang}/dashboard/placement`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded font-bold text-[13px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                >
                  {tx.profileCta}
                </Link>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Goals */}
              {Array.isArray(surveyAnswers.goals) && surveyAnswers.goals.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
                    {tx.goals}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(surveyAnswers.goals as string[]).map(g => (
                      <span
                        key={g}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded"
                        style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }}
                      >
                        {GOAL_LABELS[g]?.[lang] || g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Pace */}
                {typeof surveyAnswers.pace === 'string' && surveyAnswers.pace && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>{tx.pace}</p>
                    <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                      {PACE_LABELS[surveyAnswers.pace]?.[lang] || surveyAnswers.pace}
                    </p>
                  </div>
                )}

                {/* Style */}
                {typeof surveyAnswers.style === 'string' && surveyAnswers.style && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>{tx.style}</p>
                    <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                      {STYLE_LABELS[surveyAnswers.style]?.[lang] || surveyAnswers.style}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {typeof surveyAnswers.notes === 'string' && surveyAnswers.notes && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>{tx.notes}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
                    {surveyAnswers.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
