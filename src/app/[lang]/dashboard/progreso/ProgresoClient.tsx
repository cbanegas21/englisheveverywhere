'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { PRICING_MAP, planName, type PricingPlanKey } from '@/lib/pricing'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'

const CEFR_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type CefrLevel = (typeof CEFR_LEVELS)[number]

const LEVEL_LABELS: Record<CefrLevel, { en: string; es: string }> = {
  A0: { en: 'Complete beginner', es: 'Principiante completo' },
  A1: { en: 'Beginner', es: 'Principiante' },
  A2: { en: 'Elementary', es: 'Elemental' },
  B1: { en: 'Intermediate', es: 'Intermedio' },
  B2: { en: 'Upper intermediate', es: 'Intermedio alto' },
  C1: { en: 'Advanced', es: 'Avanzado' },
  C2: { en: 'Mastery', es: 'Maestría' },
}

const GOAL_LABELS: Record<string, { en: string; es: string }> = {
  work: { en: 'Work', es: 'Trabajo' },
  travel: { en: 'Travel', es: 'Viajes' },
  studies: { en: 'Studies', es: 'Estudios' },
  growth: { en: 'Personal growth', es: 'Crecimiento personal' },
  emigrate: { en: 'Move abroad', es: 'Emigrar' },
  other: { en: 'Other', es: 'Otro' },
}

const PACE_LABELS: Record<string, { en: string; es: string }> = {
  relaxed: { en: '1–2 classes/week', es: '1-2 clases/semana' },
  steady: { en: '3 classes/week', es: '3 clases/semana' },
  intensive: { en: 'Every day', es: 'Todos los días' },
}

const STYLE_LABELS: Record<string, { en: string; es: string }> = {
  listening: { en: 'Listening', es: 'Escuchando' },
  reading: { en: 'Reading', es: 'Leyendo' },
  speaking: { en: 'Speaking', es: 'Hablando' },
  writing: { en: 'Writing', es: 'Escribiendo' },
  mixed: { en: 'Mixed', es: 'Combinado' },
}

const t = {
  en: {
    title: 'My progress',
    subtitle: 'How you have improved since you started',
    downloadReport: 'Download report (PDF)',
    currentLevelKicker: 'Current level',
    currentLevelDesc:
      "You can hold an everyday work conversation, share experiences and opinions with confidence. Your teacher will let you know when you're ready for the next level.",
    stats: {
      completed: 'Classes',
      completedSub: 'so far',
      hours: 'Hours',
      hoursSub: 'of live class',
      remaining: 'Available',
      remainingSub: 'in your plan',
      upcoming: 'Scheduled',
      upcomingSub: 'upcoming',
    },
    profileKicker: 'Your path',
    profileTitle: 'Your learning profile',
    profileEmpty: 'Complete your placement to see your learning profile.',
    profileCta: 'Take placement',
    goals: 'Learning goals',
    pace: 'Preferred pace',
    style: 'Learning style',
    notes: 'Notes for teacher',
    timelineKicker: 'Class history',
    timelineTitle: 'Recent classes',
    timelineEmpty: 'Your journey starts here. Complete your first class to see your progress.',
    aiSummary: '◇ Summary',
    noSummary: 'Summary will appear after the class.',
    placementTitle: 'Diagnostic call',
    placementNotScheduled: 'Schedule your free diagnostic call',
    placementNotScheduledSub: "We'll assess your level and build your personalized learning plan.",
    placementNotScheduledCta: 'Schedule call',
    placementScheduledTitle: 'Your diagnostic call is scheduled',
    placementScheduledSub: (date: string, time: string) => `Booked for ${date} at ${time}.`,
    placementDoneTitle: 'Diagnostic completed',
    placementDoneSub: (level: string) => `Your level was assessed as ${level}.`,
    planTitle: 'Current plan',
    planNone: 'No active plan',
    planCta: 'Get your first plan',
    classesThisMonth: 'This month',
    classesTotal: 'classes in pack',
    duration: (m: number) => `${m} min`,
  },
  es: {
    title: 'Mi progreso',
    subtitle: 'Cómo has avanzado desde que empezaste',
    downloadReport: 'Descargar informe (PDF)',
    currentLevelKicker: 'Nivel actual',
    currentLevelDesc:
      'Puedes mantener una conversación de trabajo cotidiana, contar experiencias y opinar con seguridad. Tu maestro te dirá cuándo estés listo para el siguiente nivel.',
    stats: {
      completed: 'Clases',
      completedSub: 'hasta ahora',
      hours: 'Horas',
      hoursSub: 'de clase en vivo',
      remaining: 'Disponibles',
      remainingSub: 'en tu plan',
      upcoming: 'Agendadas',
      upcomingSub: 'próximas',
    },
    profileKicker: 'Tu camino',
    profileTitle: 'Tu perfil de aprendizaje',
    profileEmpty: 'Completa tu diagnóstico para ver tu perfil.',
    profileCta: 'Hacer diagnóstico',
    goals: 'Objetivos',
    pace: 'Ritmo preferido',
    style: 'Estilo de aprendizaje',
    notes: 'Notas para la maestra',
    timelineKicker: 'Historial de clases',
    timelineTitle: 'Clases recientes',
    timelineEmpty: 'Tu viaje empieza aquí. Completa tu primera clase para ver tu progreso.',
    aiSummary: '◇ Resumen',
    noSummary: 'El resumen aparecerá después de la clase.',
    placementTitle: 'Llamada diagnóstica',
    placementNotScheduled: 'Agenda tu llamada diagnóstica gratuita',
    placementNotScheduledSub: 'Evaluaremos tu nivel y crearemos tu plan de aprendizaje personalizado.',
    placementNotScheduledCta: 'Agendar llamada',
    placementScheduledTitle: 'Tu llamada diagnóstica está agendada',
    placementScheduledSub: (date: string, time: string) => `Agendada para el ${date} a las ${time}.`,
    placementDoneTitle: 'Diagnóstico completado',
    placementDoneSub: (level: string) => `Tu nivel fue evaluado como ${level}.`,
    planTitle: 'Plan actual',
    planNone: 'Sin plan activo',
    planCta: 'Obtén tu primer plan',
    classesThisMonth: 'Este mes',
    classesTotal: 'clases en el pack',
    duration: (m: number) => `${m} min`,
  },
}

interface PlacementBooking {
  id: string
  scheduled_at: string
  status: string
}

interface Props {
  lang: Locale
  level: string | null
  classesRemaining: number
  currentPlan: string | null
  surveyAnswers: Record<string, unknown> | null
  placementTestDone: boolean
  placementBooking: PlacementBooking | null
  completedTotal: number
  totalHours: number
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
    timeZone: 'America/Tegucigalpa', weekday: 'long', month: 'short', day: 'numeric',
  })
}

function fmtTime(iso: string, lang: 'es' | 'en') {
  // Normalize am/pm whitespace (Node ICU plain space vs Chrome U+00A0) so SSR and
  // client hydration produce byte-identical strings — avoids React #418.
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    timeZone: 'America/Tegucigalpa', hour: '2-digit', minute: '2-digit',
  }).replace(/[  ]/g, ' ')
}

function monthShort(iso: string, lang: Locale): string {
  return new Date(iso)
    .toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { timeZone: 'America/Tegucigalpa', month: 'short' })
    .toUpperCase()
    .replace(/\./g, '')
}

// Day-of-month pinned to the business zone — `new Date().getDate()` uses the host
// tz, so server (UTC) vs browser could emit a different digit at hydration (#418)
// and the numeral could disagree with the tz-pinned month/weekday beside it.
function dayNum(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { timeZone: 'America/Tegucigalpa', day: 'numeric' })
}

export default function ProgresoClient({
  lang, level, classesRemaining, currentPlan, surveyAnswers,
  placementTestDone, placementBooking,
  completedTotal, totalHours, completedThisMonth, upcomingClasses, recentBookings,
}: Props) {
  const tx = t[lang]
  const accent = 'var(--ek-red)'
  const activeIndex = level ? CEFR_LEVELS.indexOf(level as CefrLevel) : -1
  const planInfo = currentPlan ? PRICING_MAP[currentPlan as PricingPlanKey] : null
  const planLabel = currentPlan ? planName(currentPlan, lang) : null
  const planTotal = planInfo?.classes ?? 0
  const planProgress = planTotal > 0 ? Math.min(100, (completedThisMonth / planTotal) * 100) : 0

  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tt = setTimeout(() => setNow(Date.now()), 0)
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => { clearTimeout(tt); clearInterval(id) }
  }, [])

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          <Link
            href={`/${lang}/dashboard/progreso/reporte`}
            className="ek-btn ek-btn-ghost ek-btn-square"
            style={{ padding: '9px 16px', fontSize: 12, textDecoration: 'none' }}
          >
            {tx.downloadReport}
          </Link>
        }
      />

      <div style={{ padding: '28px clamp(16px, 4vw, 36px)', maxWidth: 1280, margin: '0 auto' }}>
        {/* Placement banner if not done */}
        {!placementTestDone && (() => {
          const placementDate = placementBooking
            ? new Date(placementBooking.scheduled_at).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
                timeZone: 'America/Tegucigalpa', weekday: 'long', month: 'long', day: 'numeric',
              })
            : null
          const placementTime = placementBooking
            ? new Date(placementBooking.scheduled_at).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', { timeZone: 'America/Tegucigalpa', hour: '2-digit', minute: '2-digit' }).replace(/[  ]/g, ' ')
            : null

          if (placementBooking) {
            const PLACEMENT_LIVE_WINDOW_MS = (60 + 90) * 60_000
            const isPast = now !== null
              ? now > new Date(placementBooking.scheduled_at).getTime() + PLACEMENT_LIVE_WINDOW_MS
              : false
            if (isPast) {
              return (
                <div
                  style={{
                    background: 'var(--ek-warn-bg)',
                    border: '1px solid var(--ek-warn-border)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 24,
                    fontSize: 13,
                    color: 'var(--ek-warn-text)',
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                >
                  {lang === 'es'
                    ? `Tu llamada diagnóstica del ${placementDate} a las ${placementTime} ya pasó. Contáctanos: hola@englishkolab.com`
                    : `Your diagnostic call from ${placementDate} at ${placementTime} has passed. Contact us: hola@englishkolab.com`}
                </div>
              )
            }
            return (
              <div
                style={{
                  background: 'var(--ek-card)',
                  border: '1px solid var(--ek-success-border)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  fontFamily: 'var(--ek-font-sans)',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 3,
                    alignSelf: 'stretch',
                    minHeight: 34,
                    borderRadius: 2,
                    background: 'var(--ek-success-text)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>
                    {tx.placementScheduledTitle}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 4 }}>
                    {placementDate && placementTime && tx.placementScheduledSub(placementDate, placementTime)}
                  </div>
                </div>
              </div>
            )
          }
          return (
            <div
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-red-tint-3)',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  minHeight: 34,
                  borderRadius: 2,
                  background: accent,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>
                  {tx.placementNotScheduled}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 4 }}>
                  {tx.placementNotScheduledSub}
                </div>
              </div>
              <Link
                href={`/${lang}/dashboard/placement`}
                className="ek-btn ek-btn-red ek-btn-square"
                style={{ padding: '9px 16px', fontSize: 12 }}
              >
                {tx.placementNotScheduledCta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )
        })()}

        {/* Level hero */}
        <div
          style={{
            background: 'var(--ek-card)',
            border: '1px solid var(--ek-border)',
            borderRadius: 16,
            padding: '24px clamp(16px, 4vw, 36px)',
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 32,
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: -20,
              bottom: -60,
              fontFamily: 'var(--ek-font-serif)',
              fontStyle: 'italic',
              fontSize: 260,
              lineHeight: 0.8,
              color: 'rgba(196,30,58,0.04)',
              pointerEvents: 'none',
            }}
          >
            {level || '?'}
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {tx.currentLevelKicker}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(40px, 12vw, 56px)',
                  fontWeight: 800,
                  letterSpacing: '-0.035em',
                  color: 'var(--ek-text)',
                  lineHeight: 1,
                }}
              >
                {level || '—'}
              </h2>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--ek-text-soft)',
                  letterSpacing: '-0.015em',
                }}
              >
                {level ? LEVEL_LABELS[level as CefrLevel]?.[lang] : (lang === 'es' ? 'Pendiente' : 'Pending')}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: 'var(--ek-text-soft)',
                maxWidth: 540,
                lineHeight: 1.55,
              }}
            >
              {level
                ? tx.currentLevelDesc
                : (lang === 'es'
                    ? 'Completa tu llamada diagnóstica para conocer tu nivel exacto.'
                    : 'Complete your diagnostic call to learn your exact level.')}
            </p>

            {/* CEFR ladder */}
            <div style={{ display: 'flex', gap: 4, marginTop: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              {CEFR_LEVELS.map((lvl, i) => {
                const isActive = i === activeIndex
                const isPast = i < activeIndex
                return (
                  <div key={lvl} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        padding: '7px 14px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        background: isActive ? accent : isPast ? 'var(--ek-ink)' : 'var(--ek-paper)',
                        color: isActive ? '#fff' : isPast ? 'var(--ek-on-dark)' : 'var(--ek-text-muted)',
                        border: isPast || isActive ? 0 : '1px solid var(--ek-border)',
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {lvl}
                    </div>
                    {i < CEFR_LEVELS.length - 1 && (
                      <div
                        style={{
                          width: 24,
                          height: 2,
                          background: i < activeIndex ? 'var(--ek-ink)' : 'var(--ek-border)',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stats — editorial ledger: box-less, big numbers + hairline rules.
            The actionable "Available" stat gets the red accent + a doorway to
            the plan; the others link to where the count lives. */}
        <div style={{ marginBottom: 24 }}>
          <StatLedger
            items={[
              { kicker: tx.stats.completed, value: completedTotal, sub: tx.stats.completedSub },
              { kicker: tx.stats.hours, value: `${totalHours}h`, sub: tx.stats.hoursSub },
              { kicker: tx.stats.remaining, value: classesRemaining, sub: tx.stats.remainingSub, href: `/${lang}/dashboard/plan`, accent: true },
              { kicker: tx.stats.upcoming, value: upcomingClasses, sub: tx.stats.upcomingSub, href: `/${lang}/dashboard/clases` },
            ]}
          />
        </div>

        {/* 2-column: timeline + plan/profile */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
          style={{ gap: 20 }}
        >
          {/* Timeline */}
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
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontWeight: 700,
                }}
              >
                {tx.timelineKicker}
              </div>
              <h3
                style={{
                  margin: '4px 0 0',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--ek-text)',
                  letterSpacing: '-0.015em',
                }}
              >
                {tx.timelineTitle}
              </h3>
            </header>

            {recentBookings.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', lineHeight: 1.55 }}>
                  {tx.timelineEmpty}
                </p>
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {recentBookings.map((booking) => {
                  const notes = booking.notes as { covered?: string; nextTopics?: string } | null
                  return (
                    <li
                      key={booking.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr',
                        gap: 16,
                        padding: '18px 22px',
                        borderBottom: '1px solid var(--ek-border-soft)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 9.5,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'var(--ek-text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          {monthShort(booking.scheduled_at, lang)}
                        </div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: accent,
                            letterSpacing: '-0.025em',
                            lineHeight: 1,
                            marginTop: 2,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {dayNum(booking.scheduled_at, lang)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--ek-text)',
                            marginBottom: 2,
                            textTransform: 'capitalize',
                          }}
                        >
                          {fmtDate(booking.scheduled_at, lang)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--ek-text-muted)',
                            marginBottom: 8,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {fmtTime(booking.scheduled_at, lang)} · {tx.duration(booking.duration_minutes || 60)}
                        </div>
                        {notes?.covered ? (
                          <div
                            style={{
                              background: 'var(--ek-paper)',
                              borderRadius: 8,
                              padding: '10px 12px',
                              border: '1px solid var(--ek-border)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 9.5,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: accent,
                                fontWeight: 700,
                                marginBottom: 4,
                                fontFamily: 'var(--ek-font-mono)',
                              }}
                            >
                              {tx.aiSummary}
                            </div>
                            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ek-ink-soft)', lineHeight: 1.55 }}>
                              {notes.covered}
                            </p>
                            {notes.nextTopics && (
                              <p
                                style={{
                                  margin: '4px 0 0',
                                  fontSize: 11.5,
                                  color: 'var(--ek-text-muted)',
                                  fontStyle: 'italic',
                                  fontFamily: 'var(--ek-font-serif)',
                                }}
                              >
                                → {notes.nextTopics}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p
                            style={{
                              margin: 0,
                              fontSize: 11.5,
                              color: 'var(--ek-text-muted)',
                              fontStyle: 'italic',
                              fontFamily: 'var(--ek-font-serif)',
                            }}
                          >
                            {tx.noSummary}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Right column: plan + profile */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Plan progress */}
            <div
              style={{
                background: 'var(--ek-card)',
                borderRadius: 14,
                border: '1px solid var(--ek-border)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                {tx.planTitle}
              </div>
              {planInfo ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ek-text)', letterSpacing: '-0.02em' }}>
                    {planLabel}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 4, marginBottom: 16 }}>
                    {planTotal} {tx.classesTotal}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ek-text-muted)' }}>
                        {tx.classesThisMonth}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--ek-text)',
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {completedThisMonth}/{planTotal}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: 'var(--ek-paper)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${planProgress}%`,
                          height: '100%',
                          background: accent,
                          borderRadius: 3,
                          transition: 'width 0.4s',
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text-muted)', marginBottom: 12 }}>
                    {tx.planNone}
                  </div>
                  <Link
                    href={`/${lang}/dashboard/plan`}
                    className="ek-btn ek-btn-red ek-btn-square"
                    style={{ padding: '9px 16px', fontSize: 12 }}
                  >
                    {tx.planCta}
                  </Link>
                </>
              )}
            </div>

            {/* Learning profile */}
            <div
              style={{
                background: 'var(--ek-card)',
                borderRadius: 14,
                border: '1px solid var(--ek-border)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {tx.profileKicker}
              </div>
              <h3
                style={{
                  margin: '0 0 16px',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--ek-text)',
                  letterSpacing: '-0.015em',
                }}
              >
                {tx.profileTitle}
              </h3>

              {!surveyAnswers ? (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--ek-text-soft)', marginBottom: 14, lineHeight: 1.55 }}>
                    {tx.profileEmpty}
                  </p>
                  {!placementTestDone && (
                    <Link
                      href={`/${lang}/dashboard/placement`}
                      className="ek-btn ek-btn-red ek-btn-square"
                      style={{ padding: '9px 16px', fontSize: 12 }}
                    >
                      {tx.profileCta}
                    </Link>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Array.isArray(surveyAnswers.goals) && surveyAnswers.goals.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-text-muted)',
                          marginBottom: 6,
                        }}
                      >
                        {tx.goals}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(surveyAnswers.goals as string[]).map((g) => (
                          <span
                            key={g}
                            style={{
                              fontFamily: 'var(--ek-font-mono)',
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '0.04em',
                              padding: '5px 9px',
                              borderRadius: 4,
                              background: 'var(--ek-red-tint-2)',
                              color: accent,
                              border: '1px solid var(--ek-red-tint-3)',
                            }}
                          >
                            {GOAL_LABELS[g]?.[lang] || g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {typeof surveyAnswers.pace === 'string' && surveyAnswers.pace && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-text-muted)',
                          marginBottom: 4,
                        }}
                      >
                        {tx.pace}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>
                        {PACE_LABELS[surveyAnswers.pace]?.[lang] || surveyAnswers.pace}
                      </div>
                    </div>
                  )}
                  {typeof surveyAnswers.style === 'string' && surveyAnswers.style && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-text-muted)',
                          marginBottom: 4,
                        }}
                      >
                        {tx.style}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>
                        {STYLE_LABELS[surveyAnswers.style]?.[lang] || surveyAnswers.style}
                      </div>
                    </div>
                  )}
                  {typeof surveyAnswers.notes === 'string' && surveyAnswers.notes && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-text-muted)',
                          marginBottom: 4,
                        }}
                      >
                        {tx.notes}
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ek-text-soft)', lineHeight: 1.5 }}>
                        {surveyAnswers.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
