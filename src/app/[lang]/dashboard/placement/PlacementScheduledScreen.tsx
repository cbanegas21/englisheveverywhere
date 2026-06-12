'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar, Clock, Download, ChevronDown,
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'
import JoinSessionButton from '@/components/JoinSessionButton'
import NotificationPreferences from '@/components/NotificationPreferences'

interface Props {
  lang: Locale
  bookingId: string | null
  scheduledAt: string | null
  timezone: string
  isPast?: boolean
  placementDone?: boolean
  conductorName?: string | null
}

const T = {
  en: {
    title: 'Diagnostic call',
    subtitle: "We'll figure out your English level together — no pressure, just a conversation.",
    pastTitle: 'Your call has passed',
    pastBody: (date: string, time: string) =>
      `Your diagnostic call was scheduled for ${date} at ${time} but that time has passed. You can reschedule to continue.`,
    rescheduleBtn: 'Reschedule call',
    backDashBtn: 'Back to dashboard',
    doneKicker: 'Complete',
    doneTitle: 'Your placement is complete',
    doneBody: "You've finished your diagnostic — your English level is set. Jump into your classes whenever you're ready.",
    viewProgressBtn: 'View my progress',
    scheduledBadge: 'Scheduled',
    withLabel: 'With',
    conductorPending: 'Host will be assigned soon',
    countdownPrefix: 'In',
    inProgress: 'Happening now',
    ended: 'Ended',
    cardDate: 'Date',
    cardTime: 'Time',
    cardDuration: 'Duration',
    durationValue: '60 min',
    calendarCardTitle: 'Add to calendar',
    calendarCardSub: 'Download .ics or add to Google Calendar.',
    googleCalendar: 'Add to Google Calendar',
    downloadIcs: 'Download .ics file',
    remindersTitle: 'Reminders',
    remindersSub: "We'll nudge you before the call.",
    remindersSoon: 'Coming soon',
    reminderEmail: 'Email',
    reminderSms: 'SMS',
    reminderWhatsApp: 'WhatsApp',
    reminderTiming24h: '24 hours before',
    reminderTiming1h: '1 hour before',
    prepTitle: 'Before the call',
    prep1: 'Use a quiet space with a stable internet connection.',
    prep2: 'Test your mic and speaker — plain headphones work best.',
    prep3: "Relax — there's no right or wrong answer. We're just listening.",
    prep4: "Have a notepad ready if you'd like to jot down notes.",
    faqTitle: 'Common questions',
    faqs: [
      {
        q: 'How long is the call?',
        a: 'About 60 minutes. Most of it is a conversation — we just want to hear how you speak and understand English.',
      },
      {
        q: 'Do I need to prepare anything?',
        a: 'No preparation needed. Come as you are. We place you in the right level based on the call.',
      },
      {
        q: 'Who joins the call?',
        a: 'A member of our team. They run the diagnostic and help set up your first real class.',
      },
      {
        q: 'What if I need to reschedule?',
        a: "Reach out through the platform. We'll help you pick another time.",
      },
    ],
    joinNote: "Join 15 minutes before your scheduled time — we're ready early.",
    honduras: 'Your local time',
    daysLeft: (d: number) => `${d} day${d !== 1 ? 's' : ''}`,
    hoursLeft: (h: number) => `${h} hour${h !== 1 ? 's' : ''}`,
    minsLeft: (m: number) => `${m} minute${m !== 1 ? 's' : ''}`,
  },
  es: {
    title: 'Llamada diagnóstica',
    subtitle: 'Descubrimos tu nivel de inglés juntos — sin presión, solo una conversación.',
    pastTitle: 'Tu llamada ha pasado',
    pastBody: (date: string, time: string) =>
      `Tu llamada diagnóstica estaba programada para el ${date} a las ${time} pero ya pasó. Puedes reagendarla para continuar.`,
    rescheduleBtn: 'Reagendar llamada',
    backDashBtn: 'Volver al dashboard',
    doneKicker: 'Completada',
    doneTitle: 'Tu evaluación está completa',
    doneBody: 'Completaste tu llamada diagnóstica — tu nivel de inglés ya está definido. Empieza tus clases cuando quieras.',
    viewProgressBtn: 'Ver mi progreso',
    scheduledBadge: 'Agendada',
    withLabel: 'Con',
    conductorPending: 'Asignaremos un anfitrión pronto',
    countdownPrefix: 'En',
    inProgress: 'En curso',
    ended: 'Terminada',
    cardDate: 'Fecha',
    cardTime: 'Hora',
    cardDuration: 'Duración',
    durationValue: '60 min',
    calendarCardTitle: 'Agregar al calendario',
    calendarCardSub: 'Descarga .ics o agrega a Google Calendar.',
    googleCalendar: 'Agregar a Google Calendar',
    downloadIcs: 'Descargar archivo .ics',
    remindersTitle: 'Recordatorios',
    remindersSub: 'Te avisamos antes de la llamada.',
    remindersSoon: 'Próximamente',
    reminderEmail: 'Correo',
    reminderSms: 'SMS',
    reminderWhatsApp: 'WhatsApp',
    reminderTiming24h: '24 horas antes',
    reminderTiming1h: '1 hora antes',
    prepTitle: 'Antes de la llamada',
    prep1: 'Usa un lugar tranquilo con buena conexión a internet.',
    prep2: 'Prueba tu micrófono y bocina — audífonos simples funcionan mejor.',
    prep3: 'Relájate — no hay respuestas correctas o incorrectas. Solo escuchamos.',
    prep4: 'Ten una libreta a mano si quieres tomar notas.',
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      {
        q: '¿Cuánto dura la llamada?',
        a: 'Aproximadamente 60 minutos. La mayor parte es conversación — queremos escuchar cómo hablas y entiendes inglés.',
      },
      {
        q: '¿Necesito preparar algo?',
        a: 'No necesitas preparar nada. Ven como eres. Te colocamos en el nivel correcto según la llamada.',
      },
      {
        q: '¿Quién se une a la llamada?',
        a: 'Un miembro de nuestro equipo. Hace el diagnóstico y te ayuda a programar tu primera clase real.',
      },
      {
        q: '¿Qué pasa si necesito reagendar?',
        a: 'Contáctanos por la plataforma. Te ayudamos a elegir otra hora.',
      },
    ],
    joinNote: 'Únete 15 minutos antes de tu hora — estamos listos antes.',
    honduras: 'Tu hora local',
    daysLeft: (d: number) => `${d} día${d !== 1 ? 's' : ''}`,
    hoursLeft: (h: number) => `${h} hora${h !== 1 ? 's' : ''}`,
    minsLeft: (m: number) => `${m} minuto${m !== 1 ? 's' : ''}`,
  },
}

function formatDate(iso: string, lang: Locale, timezone: string) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: timezone || 'America/Tegucigalpa',
  })
}

function formatTime(iso: string, lang: Locale, timezone: string) {
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    timeZone: timezone || 'America/Tegucigalpa',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

function buildGoogleCalendarUrl(iso: string, lang: Locale): string {
  const start = new Date(iso)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const title = lang === 'es' ? 'Llamada diagnóstica — EnglishKolab' : 'Diagnostic Call — EnglishKolab'
  const details = lang === 'es'
    ? 'Llamada diagnóstica de 60 minutos para evaluar tu nivel de inglés.'
    : '60-minute diagnostic call to assess your English level.'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

function buildIcsDataUrl(iso: string, lang: Locale): string {
  const start = new Date(iso)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const title = lang === 'es' ? 'Llamada diagnóstica — EnglishKolab' : 'Diagnostic Call — EnglishKolab'
  const details = lang === 'es'
    ? 'Llamada diagnóstica de 60 minutos para evaluar tu nivel de inglés.'
    : '60-minute diagnostic call to assess your English level.'
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EnglishKolab//Diagnostic//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@englishkolab`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}

function Countdown({ scheduledAt, lang }: { scheduledAt: string; lang: Locale }) {
  const tx = T[lang]
  const targetMs = useMemo(() => new Date(scheduledAt).getTime(), [scheduledAt])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const diff = targetMs - now
  const endedMs = targetMs + 90 * 60 * 1000

  if (now >= endedMs) {
    return <span style={{ color: 'rgba(255,255,255,0.9)' }}>{tx.ended}</span>
  }
  if (now >= targetMs) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="lk-ps-livedot" />{tx.inProgress}
      </span>
    )
  }

  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  let label: string
  if (days >= 1) {
    const remH = hours % 24
    label = remH > 0
      ? `${tx.daysLeft(days)} · ${tx.hoursLeft(remH)}`
      : tx.daysLeft(days)
  } else if (hours >= 1) {
    const remM = mins % 60
    label = remM > 0
      ? `${tx.hoursLeft(hours)} · ${tx.minsLeft(remM)}`
      : tx.hoursLeft(hours)
  } else {
    label = tx.minsLeft(Math.max(1, mins))
  }

  return <span>{tx.countdownPrefix} {label}</span>
}

export default function PlacementScheduledScreen({
  lang, bookingId, scheduledAt, timezone, isPast, placementDone, conductorName,
}: Props) {
  const tx = T[lang]
  const isEs = lang === 'es'
  const date = scheduledAt ? formatDate(scheduledAt, lang, timezone) : null
  const time = scheduledAt ? formatTime(scheduledAt, lang, timezone) : null
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // ── Scoped styles — replaces inline onMouseEnter/onMouseLeave handlers
  //    (those mix shorthand/non-shorthand style props and trigger a React
  //    console error). Unique .lk-ps-* prefix so nothing leaks. ──────────
  const styles = `
    .lk-ps-livedot {
      height: 8px; width: 8px; border-radius: 999px;
      background: #fff; display: inline-block;
      animation: lk-ps-pulse 1.6s ease-in-out infinite;
    }
    @keyframes lk-ps-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }

    .lk-ps-btn-red {
      background: var(--ek-red); color: #fff;
      transition: background 0.18s ease;
    }
    .lk-ps-btn-red:hover { background: var(--ek-red-hover); }

    .lk-ps-btn-ghost {
      background: var(--ek-paper-warm); color: var(--ek-text-soft);
      border: 1px solid var(--ek-border);
      transition: background 0.18s ease, border-color 0.18s ease;
    }
    .lk-ps-btn-ghost:hover { background: var(--ek-paper-deep); border-color: var(--ek-border-mid); }

    .lk-ps-btn-ink {
      background: var(--ek-ink); color: #fff;
      transition: background 0.18s ease;
    }
    .lk-ps-btn-ink:hover { background: #000; }

    .lk-ps-faq-trigger {
      transition: background 0.18s ease;
    }
    .lk-ps-faq-trigger:hover { background: var(--ek-red-tint); }

    .lk-ps-backlink {
      color: var(--ek-text-muted);
      transition: color 0.18s ease;
    }
    .lk-ps-backlink:hover { color: var(--ek-text); }

    .lk-ps-prep { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
    .lk-ps-prep li {
      padding-left: 14px;
      border-left: 3px solid var(--ek-red);
      font-size: 13px;
      line-height: 1.55;
      color: var(--ek-text-soft);
    }
  `

  // ── Completed state ────────────────────────────────────────────
  // Placement is finished and the level is set — there is nothing to reschedule.
  // Showing a "Reschedule call" CTA here dead-ends on a server error, so a done
  // student gets a calm "complete" view that points forward instead (placement-ui-1).
  if (placementDone) {
    return (
      <div className="min-h-full" style={{ background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)' }}>
        <style>{styles}</style>
        <DashTopBar title={tx.title} sub={tx.subtitle} />

        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10">
          <div className="max-w-[600px] mx-auto">
            <div
              className="overflow-hidden"
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
              }}
            >
              <div className="px-8 py-10" style={{ background: 'var(--ek-ink)' }}>
                <div className="ek-microlabel" style={{ color: 'var(--ek-red-light)', marginBottom: 12 }}>
                  {tx.doneKicker}
                </div>
                <h2 className="text-[24px] font-black leading-tight" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                  {tx.doneTitle}
                </h2>
              </div>
              <div className="p-8 space-y-5">
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                  {tx.doneBody}
                </p>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href={`/${lang}/dashboard/progreso`}
                    className="lk-ps-btn-red flex items-center justify-center gap-2 w-full py-3 font-bold text-[13px]"
                    style={{ borderRadius: 'var(--ek-radius-md)' }}
                  >
                    {tx.viewProgressBtn}
                  </Link>
                  <Link
                    href={`/${lang}/dashboard`}
                    className="lk-ps-btn-ghost flex items-center justify-center gap-2 w-full py-3 font-medium text-[13px]"
                    style={{ borderRadius: 'var(--ek-radius-md)' }}
                  >
                    {tx.backDashBtn}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Past state (call time passed, not yet completed) ───────────
  if (isPast) {
    return (
      <div className="min-h-full" style={{ background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)' }}>
        <style>{styles}</style>
        <DashTopBar title={tx.title} sub={tx.subtitle} />

        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10">
          <div className="max-w-[600px] mx-auto">
            <div
              className="overflow-hidden"
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
              }}
            >
              {/* Ink header band — calm editorial, no glyph-in-circle chip */}
              <div className="px-8 py-10" style={{ background: 'var(--ek-ink)' }}>
                <div className="ek-microlabel" style={{ color: 'var(--ek-red-light)', marginBottom: 12 }}>
                  {tx.ended}
                </div>
                <h2 className="text-[24px] font-black leading-tight" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                  {tx.pastTitle}
                </h2>
              </div>
              <div className="p-8 space-y-5">
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                  {date && time && tx.pastBody(date, time)}
                </p>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href={`/${lang}/dashboard/placement?reschedule=1`}
                    className="lk-ps-btn-red flex items-center justify-center gap-2 w-full py-3 font-bold text-[13px]"
                    style={{ borderRadius: 'var(--ek-radius-md)' }}
                  >
                    {tx.rescheduleBtn}
                  </Link>
                  <Link
                    href={`/${lang}/dashboard`}
                    className="lk-ps-btn-ghost flex items-center justify-center gap-2 w-full py-3 font-medium text-[13px]"
                    style={{ borderRadius: 'var(--ek-radius-md)' }}
                  >
                    {tx.backDashBtn}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Scheduled state ─────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)' }}>
      <style>{styles}</style>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-6 lg:py-8 space-y-6">

        {/* Hero card — ink surface, editorial typography */}
        <div
          className="overflow-hidden"
          style={{
            background: 'var(--ek-card)',
            border: '1px solid var(--ek-border)',
            borderRadius: 'var(--ek-radius-lg)',
          }}
        >
          <div className="relative overflow-hidden px-8 py-10 lg:px-10 lg:py-12" style={{ background: 'var(--ek-ink)' }}>
            {/* Decoration */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full" style={{ background: 'rgba(196,30,58,0.10)' }} />
            <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }} />

            <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-end">
              <div>
                {/* Status + host — squared mono micro-tags, no pill/dot */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5">
                  <span className="ek-microlabel" style={{ color: 'var(--ek-red-light)' }}>
                    {tx.scheduledBadge}
                  </span>
                  {conductorName ? (
                    <span className="ek-microlabel" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{tx.withLabel}</span>{' '}
                      {conductorName}
                    </span>
                  ) : (
                    <span className="ek-microlabel" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {tx.conductorPending}
                    </span>
                  )}
                </div>

                <p className="ek-microlabel mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>{tx.honduras}</p>
                <h2 className="text-[28px] lg:text-[36px] font-black leading-tight tracking-tight mb-2 capitalize" style={{ color: '#fff' }}>
                  {date}
                </h2>
                <div className="flex items-baseline gap-3">
                  <p className="text-[22px] lg:text-[28px] font-black tabular-nums" style={{ color: '#fff' }}>{time}</p>
                  <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.7)' }}>· {tx.durationValue}</p>
                </div>

                {scheduledAt && (
                  <div
                    className="inline-flex items-center gap-2 mt-5 px-4 py-2 text-[13px] font-semibold"
                    style={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: 'var(--ek-radius-md)',
                    }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <Countdown scheduledAt={scheduledAt} lang={lang} />
                  </div>
                )}
              </div>

              {bookingId && scheduledAt && (
                <div className="flex md:flex-col items-start gap-3">
                  <JoinSessionButton
                    lang={lang}
                    bookingId={bookingId}
                    scheduledAt={scheduledAt}
                    variant="primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Early-join note — genuine success tone */}
          <div
            className="px-8 py-4 flex items-start gap-2.5"
            style={{ background: 'var(--ek-success-bg)', borderTop: '1px solid var(--ek-success-border)' }}
          >
            <span
              className="mt-1 flex-shrink-0"
              style={{ height: 8, width: 8, borderRadius: 999, background: 'var(--ek-success-dot)' }}
            />
            <p className="text-[13px]" style={{ color: 'var(--ek-success-text)' }}>{tx.joinNote}</p>
          </div>
        </div>

        {/* Date · Time · Duration — editorial stat ledger, box-less */}
        {date && time && (
          <StatLedger
            items={[
              { kicker: tx.cardDate, value: <span className="capitalize">{date}</span> },
              { kicker: tx.cardTime, value: time, accent: true },
              { kicker: tx.cardDuration, value: tx.durationValue },
            ]}
          />
        )}

        {/* 3 cards: Calendar, Reminders, Prep */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {/* Add to calendar */}
          <div
            className="p-5 flex flex-col"
            style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)' }}
          >
            {/* 3px red hairline left-rule instead of icon-in-square chip */}
            <div className="flex gap-3 mb-4" style={{ alignSelf: 'stretch' }}>
              <span style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', flexShrink: 0 }} />
              <div>
                <h3 className="text-[14px] font-bold" style={{ color: 'var(--ek-text)' }}>{tx.calendarCardTitle}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>{tx.calendarCardSub}</p>
              </div>
            </div>
            {scheduledAt ? (
              <div className="space-y-2 mt-auto">
                <a
                  href={buildGoogleCalendarUrl(scheduledAt, lang)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lk-ps-btn-red flex items-center justify-center gap-2 w-full py-2.5 text-[12px] font-semibold"
                  style={{ borderRadius: 'var(--ek-radius-md)' }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {tx.googleCalendar}
                </a>
                <a
                  href={buildIcsDataUrl(scheduledAt, lang)}
                  download="diagnostic-call.ics"
                  className="lk-ps-btn-ghost flex items-center justify-center gap-2 w-full py-2.5 text-[12px] font-semibold"
                  style={{ borderRadius: 'var(--ek-radius-md)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  {tx.downloadIcs}
                </a>
              </div>
            ) : null}
          </div>

          {/* Reminders stub — see components/NotificationPreferences.tsx for the panel variant used in Settings. */}
          <NotificationPreferences lang={lang} variant="card" />

          {/* Prep checklist — 3px red hairline left-rule rows, no icon-in-square */}
          <div
            className="p-5 flex flex-col"
            style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)' }}
          >
            <div className="flex gap-3 mb-4" style={{ alignSelf: 'stretch' }}>
              <span style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', flexShrink: 0 }} />
              <div>
                <h3 className="text-[14px] font-bold" style={{ color: 'var(--ek-text)' }}>{tx.prepTitle}</h3>
              </div>
            </div>
            <ul className="lk-ps-prep mt-1">
              <li>{tx.prep1}</li>
              <li>{tx.prep2}</li>
              <li>{tx.prep3}</li>
              <li>{tx.prep4}</li>
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <div
          className="overflow-hidden"
          style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)' }}
        >
          <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--ek-border)' }}>
            <h3 className="text-[15px] font-black" style={{ color: 'var(--ek-text)' }}>{tx.faqTitle}</h3>
          </div>
          <div>
            {tx.faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < tx.faqs.length - 1 ? '1px solid var(--ek-border-soft)' : 'none' }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="lk-ps-faq-trigger w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                  >
                    <span className="text-[14px] font-semibold" style={{ color: 'var(--ek-text)' }}>{faq.q}</span>
                    <ChevronDown
                      className="h-4 w-4 flex-shrink-0 transition-transform"
                      style={{ color: 'var(--ek-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Back link */}
        <div className="text-center pb-4">
          <Link
            href={`/${lang}/dashboard`}
            className="lk-ps-backlink inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium"
            style={{ borderRadius: 'var(--ek-radius-md)' }}
          >
            {isEs ? '← Volver al dashboard' : '← Back to dashboard'}
          </Link>
        </div>
      </div>
    </div>
  )
}
