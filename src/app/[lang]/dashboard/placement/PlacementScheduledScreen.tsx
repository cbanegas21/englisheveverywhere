'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, AlertCircle, Calendar, Clock, Download, Headphones, Mic,
  Wifi, Lightbulb, ChevronDown, Sparkles,
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'
import NotificationPreferences from '@/components/NotificationPreferences'

interface Props {
  lang: Locale
  bookingId: string | null
  scheduledAt: string | null
  timezone: string
  isPast?: boolean
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
    honduras: 'Honduras time (CST)',
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
    honduras: 'Hora de Honduras (CST)',
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

function formatTime(iso: string, timezone: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: timezone || 'America/Tegucigalpa',
    hour: '2-digit', minute: '2-digit',
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
    return <span className="text-white/90">{tx.ended}</span>
  }
  if (now >= targetMs) {
    return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white animate-pulse" />{tx.inProgress}</span>
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
  lang, bookingId, scheduledAt, timezone, isPast, conductorName,
}: Props) {
  const tx = T[lang]
  const isEs = lang === 'es'
  const date = scheduledAt ? formatDate(scheduledAt, lang, timezone) : null
  const time = scheduledAt ? formatTime(scheduledAt, timezone) : null
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // ── Past state ─────────────────────────────────────────────────
  if (isPast) {
    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <div className="max-w-[1200px] mx-auto">
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10">
          <div className="max-w-[600px] mx-auto">
            <div className="rounded-3xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}>
              <div className="py-10 px-6 text-center" style={{ background: 'linear-gradient(135deg, #D97706, #B45309)' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <AlertCircle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-[22px] font-black text-white">{tx.pastTitle}</h2>
              </div>
              <div className="p-8 space-y-5">
                <p className="text-[14px] leading-relaxed text-center" style={{ color: '#374151' }}>
                  {date && time && tx.pastBody(date, time)}
                </p>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href={`/${lang}/dashboard/placement?reschedule=1`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-[13px] transition-all"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                    onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                  >
                    {tx.rescheduleBtn}
                  </Link>
                  <Link
                    href={`/${lang}/dashboard`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium text-[13px] transition-all"
                    style={{ background: '#F3F4F6', color: '#374151' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#E5E7EB')}
                    onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#F3F4F6')}
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
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[1200px] mx-auto">
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
          <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-6 lg:py-8 space-y-6">

        {/* Hero card */}
        <div className="rounded-3xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}>
          <div className="relative overflow-hidden px-8 py-10 lg:px-10 lg:py-12" style={{ background: 'linear-gradient(135deg, #C41E3A, #8B1529)' }}>
            {/* Decoration */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

            <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white">{tx.scheduledBadge}</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  >
                    {conductorName ? (
                      <>
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                          style={{ background: '#fff', color: '#8B1529' }}
                        >
                          {conductorName.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="text-[11px] font-bold text-white">
                          <span className="opacity-70">{tx.withLabel}</span> {conductorName}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                        {tx.conductorPending}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[13px] font-bold uppercase tracking-widest text-white/70 mb-2">{tx.honduras}</p>
                <h2 className="text-[28px] lg:text-[36px] font-black text-white leading-tight tracking-tight mb-2 capitalize">
                  {date}
                </h2>
                <div className="flex items-baseline gap-3">
                  <p className="text-[22px] lg:text-[28px] font-black text-white tabular-nums">{time}</p>
                  <p className="text-[14px] text-white/80">· {tx.durationValue}</p>
                </div>

                {scheduledAt && (
                  <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
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

          <div className="px-8 py-4 flex items-start gap-2.5" style={{ background: 'rgba(16,185,129,0.06)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#047857' }} />
            <p className="text-[13px]" style={{ color: '#047857' }}>{tx.joinNote}</p>
          </div>
        </div>

        {/* 3 cards: Calendar, Reminders, Prep */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {/* Add to calendar */}
          <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
                <Calendar className="h-5 w-5" style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.calendarCardTitle}</h3>
                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.calendarCardSub}</p>
              </div>
            </div>
            {scheduledAt ? (
              <div className="space-y-2 mt-auto">
                <a
                  href={buildGoogleCalendarUrl(scheduledAt, lang)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{ background: '#3B82F6', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#2563EB')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#3B82F6')}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {tx.googleCalendar}
                </a>
                <a
                  href={buildIcsDataUrl(scheduledAt, lang)}
                  download="diagnostic-call.ics"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#E5E7EB')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#F3F4F6')}
                >
                  <Download className="h-3.5 w-3.5" />
                  {tx.downloadIcs}
                </a>
              </div>
            ) : null}
          </div>

          {/* Reminders stub — see components/NotificationPreferences.tsx for the panel variant used in Settings. */}
          <NotificationPreferences lang={lang} variant="card" />

          {/* Prep checklist */}
          <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <Lightbulb className="h-5 w-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.prepTitle}</h3>
              </div>
            </div>
            <ul className="space-y-3 mt-1">
              {[
                { icon: Wifi, text: tx.prep1 },
                { icon: Mic, text: tx.prep2 },
                { icon: Sparkles, text: tx.prep3 },
                { icon: Headphones, text: tx.prep4 },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                    <span className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>{item.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="px-6 py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <h3 className="text-[15px] font-black" style={{ color: '#111111' }}>{tx.faqTitle}</h3>
          </div>
          <div>
            {tx.faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < tx.faqs.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="text-[14px] font-semibold" style={{ color: '#111111' }}>{faq.q}</span>
                    <ChevronDown
                      className="h-4 w-4 flex-shrink-0 transition-transform"
                      style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#6B7280')}
          >
            {isEs ? '← Volver al dashboard' : '← Back to dashboard'}
          </Link>
        </div>
      </div>
    </div>
  )
}

