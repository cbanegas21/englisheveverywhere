// Reminder cron. Runs from vercel.json every 15 minutes. For each confirmed
// upcoming booking it fires two emails at most: one ~24h before the class,
// one ~1h before. Both are idempotent via `reminder_24h_sent_at` /
// `reminder_1h_sent_at` stamps on the bookings row.
//
// Auth: requires `Authorization: Bearer ${CRON_SECRET}`. Vercel cron sets this
// header automatically from the `CRON_SECRET` env var.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// How far ahead we scan for 24h reminders. A scheduled class at T gets the
// email when cron runs between T-24h and T-23h45m (i.e. the first run that
// falls inside the 15-min cron cadence window after T-24h).
const WIN_24H_LOWER_H = 23.5
const WIN_24H_UPPER_H = 24.5

const WIN_1H_LOWER_MIN = 45
const WIN_1H_UPPER_MIN = 75

function formatScheduled(iso: string, lang: 'es' | 'en') {
  return new Date(iso).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })
}

type Profile = { full_name: string | null; email: string | null } | null
type BookingRow = {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  type: string | null
  student: { profile: Profile } | { profile: Profile }[] | null
  teacher: { profile: Profile } | { profile: Profile }[] | null
}

function pickProfile(raw: { profile: Profile } | { profile: Profile }[] | null): Profile {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0]?.profile ?? null
  return raw.profile
}

async function sendEmail(params: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

function reminderHtml(params: {
  lang: 'es' | 'en'
  audience: 'student' | 'teacher'
  window: '24h' | '1h'
  recipientName: string
  counterpartName: string
  scheduled: string
  appUrl: string
  bookingId: string
}) {
  const { lang, audience, window, recipientName, counterpartName, scheduled, appUrl, bookingId } = params
  const roomUrl = `${appUrl}/${lang}/sala/${bookingId}`
  const isEs = lang === 'es'

  const greeting = isEs ? `Hola ${recipientName}` : `Hi ${recipientName}`
  const heading = isEs
    ? window === '24h' ? 'Tu clase es en 24 horas' : 'Tu clase empieza pronto'
    : window === '24h' ? 'Your class is in 24 hours' : 'Your class starts soon'
  const withLine = isEs
    ? audience === 'student' ? `Con tu maestro ${counterpartName}` : `Con tu estudiante ${counterpartName}`
    : audience === 'student' ? `With your teacher ${counterpartName}` : `With your student ${counterpartName}`
  const cta = isEs ? 'Ir a la clase' : 'Go to the class'
  const whenLabel = isEs ? 'Cuándo' : 'When'

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 8px 0">${heading}</h2>
      <p style="color:#4B5563;margin:0 0 16px 0">${greeting},</p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 16px 0">
        <tr>
          <td style="padding:4px 0;color:#9CA3AF;font-size:13px">${whenLabel}</td>
          <td style="padding:4px 0;color:#111;font-weight:600">${scheduled}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#9CA3AF;font-size:13px">${isEs ? 'Con' : 'With'}</td>
          <td style="padding:4px 0;color:#111;font-weight:600">${counterpartName}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0 0">
        <a href="${roomUrl}"
           style="background:#C41E3A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          ${cta}
        </a>
      </p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:32px">${withLine}</p>
    </div>
  `
}

async function processWindow(params: {
  admin: ReturnType<typeof createAdminClient>
  apiKey: string
  fromEmail: string
  appUrl: string
  windowKey: '24h' | '1h'
  lowerMs: number
  upperMs: number
  stampColumn: 'reminder_24h_sent_at' | 'reminder_1h_sent_at'
}): Promise<{ scanned: number; sent: number }> {
  const { admin, apiKey, fromEmail, appUrl, windowKey, lowerMs, upperMs, stampColumn } = params
  const now = Date.now()
  const lowerIso = new Date(now + lowerMs).toISOString()
  const upperIso = new Date(now + upperMs).toISOString()

  const { data: bookings } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, type,
      student:students(profile:profiles(full_name, email)),
      teacher:teachers(profile:profiles(full_name, email))
    `)
    .eq('status', 'confirmed')
    .is(stampColumn, null)
    .gte('scheduled_at', lowerIso)
    .lte('scheduled_at', upperIso)

  if (!bookings || bookings.length === 0) return { scanned: 0, sent: 0 }

  let sent = 0
  for (const b of bookings as unknown as BookingRow[]) {
    const studentProfile = pickProfile(b.student)
    const teacherProfile = pickProfile(b.teacher)
    const studentName = studentProfile?.full_name || 'Estudiante'
    const teacherName = teacherProfile?.full_name || 'Maestro'
    // We key language off the student profile when we can — students set the
    // locale for the platform. Fall back to Spanish (site default).
    const lang: 'es' | 'en' = 'es'
    const scheduled = formatScheduled(b.scheduled_at, lang)

    const emails: Array<{
      audience: 'student' | 'teacher'
      to: string
      recipientName: string
      counterpartName: string
    }> = []
    if (studentProfile?.email) {
      emails.push({
        audience: 'student',
        to: studentProfile.email,
        recipientName: studentName,
        counterpartName: teacherName,
      })
    }
    if (teacherProfile?.email) {
      emails.push({
        audience: 'teacher',
        to: teacherProfile.email,
        recipientName: teacherName,
        counterpartName: studentName,
      })
    }
    if (emails.length === 0) continue

    let anySent = false
    for (const e of emails) {
      const ok = await sendEmail({
        apiKey,
        from: fromEmail,
        to: e.to,
        subject: windowKey === '24h'
          ? (lang === 'es' ? 'Tu clase es mañana' : 'Your class is tomorrow')
          : (lang === 'es' ? 'Tu clase empieza pronto' : 'Your class starts soon'),
        html: reminderHtml({
          lang,
          audience: e.audience,
          window: windowKey,
          recipientName: e.recipientName,
          counterpartName: e.counterpartName,
          scheduled,
          appUrl,
          bookingId: b.id,
        }),
      })
      if (ok) anySent = true
    }

    // Stamp regardless of individual delivery success so we don't retry the
    // whole batch every 15 minutes on a single bad address. Resend returns
    // ok=false for hard bounces; we trade a possible missed reminder for
    // protection against runaway sends.
    if (anySent) {
      await admin
        .from('bookings')
        .update({ [stampColumn]: new Date().toISOString() })
        .eq('id', b.id)
      sent += 1
    }
  }

  return { scanned: bookings.length, sent }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (!apiKey || apiKey === 're_placeholder') {
    return NextResponse.json({ ok: true, skipped: 'resend-not-configured' })
  }

  const admin = createAdminClient()

  const r24 = await processWindow({
    admin,
    apiKey,
    fromEmail,
    appUrl,
    windowKey: '24h',
    lowerMs: WIN_24H_LOWER_H * 60 * 60 * 1000,
    upperMs: WIN_24H_UPPER_H * 60 * 60 * 1000,
    stampColumn: 'reminder_24h_sent_at',
  })
  const r1 = await processWindow({
    admin,
    apiKey,
    fromEmail,
    appUrl,
    windowKey: '1h',
    lowerMs: WIN_1H_LOWER_MIN * 60 * 1000,
    upperMs: WIN_1H_UPPER_MIN * 60 * 1000,
    stampColumn: 'reminder_1h_sent_at',
  })

  return NextResponse.json({ ok: true, window24h: r24, window1h: r1 })
}
