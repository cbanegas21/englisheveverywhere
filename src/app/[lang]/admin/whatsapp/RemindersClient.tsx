'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/i18n/translations'

export interface ReminderRow {
  bookingId: string
  scheduledAt: string
  type: string
  studentName: string | null
  phone: string | null
  studentLang: 'en' | 'es'
  wants24h: boolean
  wants1h: boolean
  teacherName: string | null
}

interface Props {
  lang: Locale
  reminders: ReminderRow[]
  windowDays: number
  appUrl: string
  nowIso: string
}

const TZ = 'America/Tegucigalpa'
// A class within this many hours is "due soon" — its 24h reminder is due now-ish.
const DUE_SOON_HOURS = 26

const STR = {
  en: {
    kicker: '↳ Admin · Manual reminders',
    title: 'WhatsApp reminders',
    subtitle: (d: number) =>
      `Students who opted into WhatsApp with a class in the next ${d} days. Send each reminder by hand — tap WhatsApp to open a chat with the message ready.`,
    summaryClasses: (n: number) => `${n} upcoming ${n === 1 ? 'class' : 'classes'}`,
    summaryNoPhone: (n: number) => `${n} missing a phone number`,
    dueSoon: 'Due soon',
    dueSoonHint: 'Class within 26 hours — send the 24-hour reminder now.',
    later: 'Later this week',
    emptyTitle: 'Nothing to send',
    emptyBody: 'No students with WhatsApp reminders have an upcoming class in this window.',
    student: 'Student',
    teacher: 'Teacher',
    noTeacher: 'Unassigned',
    wants: 'Wants',
    w24: '24h',
    w1: '1h',
    sendBy: 'Send by',
    noPhone: 'No phone on file',
    noPhoneHint: 'Ask the student to add their number in Settings.',
    whatsapp: 'WhatsApp',
    copyNumber: 'Copy number',
    copied: 'Copied',
    placement: 'Placement',
    klass: 'Class',
    in: (s: string) => `in ${s}`,
  },
  es: {
    kicker: '↳ Admin · Recordatorios manuales',
    title: 'Recordatorios de WhatsApp',
    subtitle: (d: number) =>
      `Estudiantes que activaron WhatsApp con clase en los próximos ${d} días. Envía cada recordatorio a mano — toca WhatsApp para abrir el chat con el mensaje listo.`,
    summaryClasses: (n: number) => `${n} ${n === 1 ? 'clase próxima' : 'clases próximas'}`,
    summaryNoPhone: (n: number) => `${n} sin número de teléfono`,
    dueSoon: 'Para enviar ya',
    dueSoonHint: 'Clase en menos de 26 horas — envía el recordatorio de 24 horas ahora.',
    later: 'Más adelante esta semana',
    emptyTitle: 'Nada por enviar',
    emptyBody: 'Ningún estudiante con recordatorios de WhatsApp tiene clase próxima en esta ventana.',
    student: 'Estudiante',
    teacher: 'Maestro',
    noTeacher: 'Sin asignar',
    wants: 'Quiere',
    w24: '24h',
    w1: '1h',
    sendBy: 'Enviar antes de',
    noPhone: 'Sin teléfono registrado',
    noPhoneHint: 'Pide al estudiante que agregue su número en Configuración.',
    whatsapp: 'WhatsApp',
    copyNumber: 'Copiar número',
    copied: 'Copiado',
    placement: 'Diagnóstico',
    klass: 'Clase',
    in: (s: string) => `en ${s}`,
  },
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

function fmtDateTime(iso: string, loc: string): string {
  return new Date(iso).toLocaleString(loc, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })
}

function fmtTime(iso: string, loc: string): string {
  return new Date(iso).toLocaleTimeString(loc, {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })
}

function fmtSendBy(iso: string, offsetMs: number, loc: string): string {
  return new Date(new Date(iso).getTime() - offsetMs).toLocaleString(loc, {
    weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })
}

export default function RemindersClient({ lang, reminders, windowDays, appUrl, nowIso }: Props) {
  const t = STR[lang]
  const loc = lang === 'es' ? 'es-HN' : 'en-US'
  const nowMs = new Date(nowIso).getTime()
  const [copied, setCopied] = useState<string | null>(null)

  function relative(ms: number): string {
    const h = ms / 3_600_000
    let s: string
    if (h < 1) s = `${Math.max(1, Math.round(ms / 60_000))} min`
    else if (h < 24) s = `${Math.round(h)} h`
    else s = `${Math.round(h / 24)} d`
    return t.in(s)
  }

  function buildMessage(r: ReminderRow): string {
    const when = fmtDateTime(r.scheduledAt, r.studentLang === 'es' ? 'es-HN' : 'en-US')
    const join = `${appUrl}/${r.studentLang}/sala/${r.bookingId}`
    const name = r.studentName || ''
    if (r.studentLang === 'en') {
      const withT = r.teacherName ? ` with ${r.teacherName}` : ''
      return `Hi ${name}! Reminder: your EnglishKolab class${withT} is on ${when} (Honduras time). Join here: ${join}`
    }
    const conT = r.teacherName ? ` con ${r.teacherName}` : ''
    return `¡Hola ${name}! Te recordamos tu clase de EnglishKolab${conT} el ${when} (hora de Honduras). Únete aquí: ${join}`
  }

  async function copyNumber(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(phone)
      setTimeout(() => setCopied(null), 1800)
    } catch { /* clipboard blocked — ignore */ }
  }

  const dueSoon = reminders.filter(r => new Date(r.scheduledAt).getTime() - nowMs <= DUE_SOON_HOURS * 3_600_000)
  const later = reminders.filter(r => new Date(r.scheduledAt).getTime() - nowMs > DUE_SOON_HOURS * 3_600_000)
  const noPhoneCount = reminders.filter(r => !r.phone || digitsOnly(r.phone).length < 8).length

  function Row({ r }: { r: ReminderRow }) {
    const ms = new Date(r.scheduledAt).getTime() - nowMs
    const phoneOk = !!r.phone && digitsOnly(r.phone).length >= 8
    return (
      <div className="ek-wa-row">
        {/* When */}
        <div style={{ minWidth: 150 }}>
          <div style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>
            {fmtDateTime(r.scheduledAt, loc)}
          </div>
          <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, color: 'var(--ek-text-muted)', marginTop: 2 }}>
            {relative(ms)} · {r.type === 'placement_test' ? t.placement : t.klass}
          </div>
        </div>

        {/* Student + teacher */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text)' }}>{r.studentName || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 2 }}>
            {t.teacher}: {r.teacherName || t.noTeacher}
          </div>
        </div>

        {/* Wanted windows + send-by */}
        <div style={{ minWidth: 150 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
            {r.wants24h && <span className="ek-wa-badge">{t.w24}</span>}
            {r.wants1h && <span className="ek-wa-badge">{t.w1}</span>}
          </div>
          <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10.5, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>
            {r.wants24h && <div>{t.sendBy} {fmtSendBy(r.scheduledAt, 24 * 3_600_000, loc)}</div>}
            {r.wants1h && <div>{t.sendBy} {fmtSendBy(r.scheduledAt, 3_600_000, loc)}</div>}
          </div>
        </div>

        {/* Phone + actions */}
        <div style={{ minWidth: 190, textAlign: 'right' }}>
          {phoneOk ? (
            <>
              <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: 'var(--ek-text-soft)', marginBottom: 6 }}>{r.phone}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <a
                  className="ek-wa-send"
                  href={`https://wa.me/${digitsOnly(r.phone!)}?text=${encodeURIComponent(buildMessage(r))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.whatsapp}
                </a>
                <button className="ek-wa-copy" onClick={() => copyNumber(r.phone!)}>
                  {copied === r.phone ? t.copied : t.copyNumber}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-red)' }}>{t.noPhone}</div>
              <div style={{ fontSize: 11, color: 'var(--ek-text-muted)', marginTop: 2 }}>{t.noPhoneHint}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`
        .ek-wa-row {
          display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
          padding: 16px 18px; border: 1px solid var(--ek-border);
          border-radius: var(--ek-radius-md); background: var(--ek-card);
        }
        .ek-wa-row + .ek-wa-row { margin-top: 8px; }
        .ek-wa-badge {
          font-family: var(--ek-font-mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; padding: 2px 7px; border-radius: 999px;
          color: var(--ek-text-soft); background: var(--ek-paper-warm);
          border: 1px solid var(--ek-border);
        }
        .ek-wa-send {
          display: inline-flex; align-items: center; padding: 7px 14px;
          border-radius: var(--ek-radius-sm); background: var(--ek-red); color: #fff;
          font-size: 12.5px; font-weight: 700; text-decoration: none;
          border: 1px solid var(--ek-red); transition: background 0.15s ease;
        }
        .ek-wa-send:hover { background: var(--ek-red-hover); }
        .ek-wa-copy {
          padding: 7px 12px; border-radius: var(--ek-radius-sm);
          background: var(--ek-card); color: var(--ek-text-soft);
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          border: 1px solid var(--ek-border); transition: border-color 0.15s ease, color 0.15s ease;
        }
        .ek-wa-copy:hover { border-color: var(--ek-border-mid); color: var(--ek-text); }
        .ek-wa-section-head {
          display: flex; align-items: baseline; gap: 10px; margin: 28px 0 12px;
        }
      `}</style>

      {/* Header */}
      <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ek-text-muted)', marginBottom: 6 }}>
        {t.kicker}
      </div>
      <h1 style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 30, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ek-text)', lineHeight: 1.1 }}>
        {t.title}
      </h1>
      <p style={{ fontSize: 13, marginTop: 8, maxWidth: 640, lineHeight: 1.55, color: 'var(--ek-text-muted)' }}>
        {t.subtitle(windowDays)}
      </p>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 16, fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: 'var(--ek-text-soft)' }}>
        <span>{t.summaryClasses(reminders.length)}</span>
        {noPhoneCount > 0 && <span style={{ color: 'var(--ek-red)' }}>{t.summaryNoPhone(noPhoneCount)}</span>}
      </div>

      {reminders.length === 0 ? (
        <div style={{ marginTop: 36, padding: '40px 24px', textAlign: 'center', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-md)', background: 'var(--ek-card)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)' }}>{t.emptyTitle}</div>
          <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', marginTop: 6 }}>{t.emptyBody}</p>
        </div>
      ) : (
        <>
          {dueSoon.length > 0 && (
            <>
              <div className="ek-wa-section-head">
                <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-red)', fontFamily: 'var(--ek-font-mono)' }}>{t.dueSoon}</h2>
                <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{t.dueSoonHint}</span>
              </div>
              {dueSoon.map(r => <Row key={r.bookingId} r={r} />)}
            </>
          )}
          {later.length > 0 && (
            <>
              <div className="ek-wa-section-head">
                <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>{t.later}</h2>
              </div>
              {later.map(r => <Row key={r.bookingId} r={r} />)}
            </>
          )}
        </>
      )}
    </div>
  )
}
