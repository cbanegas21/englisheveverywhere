// Booking-reminder scheduling via Resend's native scheduled-delivery.
//
// When a booking is confirmed (admin assigns a teacher + the booking flips to
// 'confirmed') we schedule four emails on Resend with explicit `scheduled_at`
// timestamps: student @ T-24h, teacher @ T-24h, student @ T-1h, teacher @ T-1h.
// Resend fires them without any polling on our end, replacing the old
// `/api/cron/send-reminders` Vercel cron.
//
// The email IDs are persisted on `bookings.scheduled_email_ids` so we can
// cancel them via POST /emails/:id/cancel if the booking is cancelled or
// rescheduled.
//
// All network calls are fire-and-forget per the platform convention: a Resend
// hiccup must never break the user-facing booking action.
//
// Auth: uses RESEND_API_KEY. Dev mode (`re_placeholder`) short-circuits to a
// no-op so local runs don't try to hit Resend.

import { createAdminClient } from '@/lib/supabase/admin'
import { buildBookingIcs } from '@/lib/ics'

const RESEND_BASE = 'https://api.resend.com'

type ReminderWindow = '24h' | '1h'
type Audience = 'student' | 'teacher'
type Lang = 'es' | 'en'

// profiles.notification_preferences — channel + per-window toggles. All default
// ON when unset (matches the UI's DEFAULT_PREFS, minus the off-by-default
// SMS/WhatsApp which only matter once those providers are keyed).
type NotifPrefs = {
  email?: boolean
  sms?: boolean
  whatsapp?: boolean
  before24h?: boolean
  before1h?: boolean
}

type Recipient = {
  audience: Audience
  email: string
  recipientName: string
  counterpartName: string
  lang: Lang
  // IANA zone name (e.g. "America/Tegucigalpa"). Fallback applied before this
  // struct is built, so consumers can always rely on a valid zone here.
  timezone: string
  prefs: NotifPrefs | null
}

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY
  return !!key && key !== 're_placeholder'
}

// Validate user-supplied IANA zones before handing to Intl. An unknown zone
// throws RangeError inside toLocaleString, which would blow up the whole
// schedule call. We try once and fall back to Tegucigalpa on failure.
function safeZone(candidate: string | null | undefined): string {
  const fallback = 'America/Tegucigalpa'
  if (!candidate) return fallback
  try {
    new Date().toLocaleString('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return fallback
  }
}

// Email reminders honor the recipient's saved preferences. The channel toggle
// (email) and the per-window timing toggle (before24h / before1h) both default
// ON when unset.
//
// Other channels (deferred features, not built here):
//   - SMS: dropped for now — most expensive channel and least used by our
//     Honduras audience, who live on WhatsApp.
//   - WhatsApp: deferred. Per-message delivery will ride a future worker
//     (WhatsApp Cloud API / n8n / a cron worker), not the Resend scheduled-send
//     path, since Cloud API has no native scheduled send. The `prefs.whatsapp`
//     toggle is the integration point when that lands.
// Until then, reliable no-cost reminders come from email + the calendar invite
// (.ics) attached to the confirmation email below, whose VALARMs fire native
// device reminders.
function emailEnabledFor(prefs: NotifPrefs | null, window: ReminderWindow): boolean {
  if (!prefs) return true
  const channelOn = prefs.email !== false
  const windowOn = window === '24h' ? prefs.before24h !== false : prefs.before1h !== false
  return channelOn && windowOn
}

function formatScheduled(iso: string, lang: Lang, timezone: string): string {
  return new Date(iso).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
    timeZone: timezone,
  })
}

function reminderHtml(params: {
  lang: Lang
  audience: Audience
  window: ReminderWindow
  recipientName: string
  counterpartName: string
  scheduled: string
  appUrl: string
  bookingId: string
}): string {
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
      <p style="color:#6B7280;font-size:12px;margin:16px 0 0 0">${
        isEs
          ? 'Puedes unirte hasta 90 minutos después de la hora de inicio.'
          : 'You can join up to 90 minutes after the scheduled start time.'
      }</p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:32px">${withLine}</p>
    </div>
  `
}

// Confirmation email — sent immediately when a booking becomes confirmed (a
// teacher is assigned). For the student this is their first email about the
// class; it carries the .ics calendar invite so the class lands in their
// calendar right away with native VALARM reminders.
function confirmationHtml(params: {
  lang: Lang
  audience: Audience
  recipientName: string
  counterpartName: string
  scheduled: string
  appUrl: string
  bookingId: string
}): string {
  const { lang, audience, recipientName, counterpartName, scheduled, appUrl, bookingId } = params
  const roomUrl = `${appUrl}/${lang}/sala/${bookingId}`
  const isEs = lang === 'es'

  const greeting = isEs ? `Hola ${recipientName}` : `Hi ${recipientName}`
  const heading = isEs ? 'Tu clase está confirmada' : 'Your class is confirmed'
  const withLine = isEs
    ? audience === 'student' ? `Con tu maestro ${counterpartName}` : `Con tu estudiante ${counterpartName}`
    : audience === 'student' ? `With your teacher ${counterpartName}` : `With your student ${counterpartName}`
  const cta = isEs ? 'Ir a la clase' : 'Go to the class'
  const whenLabel = isEs ? 'Cuándo' : 'When'
  const withLabel = isEs ? 'Con' : 'With'
  const calNote = isEs
    ? 'Adjuntamos una invitación de calendario — ábrela para agregar la clase a tu calendario y recibir un recordatorio automático.'
    : 'We\'ve attached a calendar invite — open it to add the class to your calendar and get an automatic reminder.'

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
          <td style="padding:4px 0;color:#9CA3AF;font-size:13px">${withLabel}</td>
          <td style="padding:4px 0;color:#111;font-weight:600">${counterpartName}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0 0">
        <a href="${roomUrl}"
           style="background:#C41E3A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          ${cta}
        </a>
      </p>
      <p style="color:#6B7280;font-size:12px;margin:16px 0 0 0">${calNote}</p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:32px">${withLine}</p>
    </div>
  `
}

// Pull a bare address out of an EMAIL_FROM that may be "Name <addr>" or a plain
// address. Used for the ICS ORGANIZER mailto.
function bareEmail(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return m ? m[1] : from
}

// Sends the confirmation email immediately (no scheduled_at) with the .ics
// attached as a base64 text/calendar part. Best-effort — never throws into the
// caller; a Resend hiccup must not break the confirm action.
async function sendConfirmationEmail(params: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  icsBase64: string
}): Promise<void> {
  try {
    await fetch(`${RESEND_BASE}/emails`, {
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
        attachments: [{
          filename: 'clase-englishkolab.ics',
          content: params.icsBase64,
          content_type: 'text/calendar',
        }],
      }),
    })
  } catch {
    // Swallow — best-effort. The scheduled reminder emails still go out.
  }
}

async function scheduleOne(params: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  scheduledAtIso: string
}): Promise<string | null> {
  try {
    const res = await fetch(`${RESEND_BASE}/emails`, {
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
        scheduled_at: params.scheduledAtIso,
      }),
    })
    if (!res.ok) return null
    const body = await res.json() as { id?: string }
    return body.id ?? null
  } catch {
    return null
  }
}

async function cancelOne(apiKey: string, emailId: string): Promise<void> {
  try {
    await fetch(`${RESEND_BASE}/emails/${emailId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch {
    // Swallow — best-effort cancel. Worst case the email fires as scheduled
    // against a cancelled booking; the link in the email still works or
    // surfaces a cancelled-booking page. Not a user-action failure.
  }
}

// Schedules the four reminder emails for a booking and persists the Resend
// email IDs on `bookings.scheduled_email_ids`. Idempotent — if email IDs are
// already present, those are cancelled first before scheduling new ones so
// repeated calls (e.g. reschedule) don't leave dangling scheduled sends.
//
// Fire-and-forget from callers — any failure here must not break the parent
// booking action.
export async function scheduleBookingReminders(bookingId: string): Promise<void> {
  if (!isResendConfigured()) return

  const apiKey = process.env.RESEND_API_KEY as string
  const fromEmail = process.env.EMAIL_FROM || 'noreply@englishkolab.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, scheduled_email_ids,
      student:students(profile:profiles(full_name, email, timezone, preferred_language, notification_preferences)),
      teacher:teachers(profile:profiles(full_name, email, timezone, preferred_language, notification_preferences))
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || !booking.scheduled_at) return

  // Cancel any pre-existing scheduled emails for this booking before
  // scheduling fresh ones.
  const existing = (booking as { scheduled_email_ids?: string[] | null }).scheduled_email_ids
  if (existing && existing.length > 0) {
    await Promise.all(existing.map((id) => cancelOne(apiKey, id)))
  }

  type ProfileLike = {
    full_name: string | null
    email: string | null
    timezone: string | null
    preferred_language: Lang | null
    notification_preferences: NotifPrefs | null
  }
  const pickProfile = (raw: unknown): ProfileLike | null => {
    if (!raw) return null
    const unwrapOuter = Array.isArray(raw) ? (raw[0] as { profile?: unknown } | undefined) : (raw as { profile?: unknown })
    const profile = unwrapOuter?.profile
    if (!profile) return null
    return (Array.isArray(profile) ? profile[0] : profile) as ProfileLike
  }

  const studentProfile = pickProfile(booking.student)
  const teacherProfile = pickProfile(booking.teacher)
  const studentName = studentProfile?.full_name || 'Estudiante'
  const teacherName = teacherProfile?.full_name || 'Maestro'

  const recipients: Recipient[] = []
  if (studentProfile?.email) {
    recipients.push({
      audience: 'student',
      email: studentProfile.email,
      recipientName: studentName,
      counterpartName: teacherName,
      lang: studentProfile.preferred_language ?? 'es',
      timezone: safeZone(studentProfile.timezone),
      prefs: studentProfile.notification_preferences ?? null,
    })
  }
  if (teacherProfile?.email) {
    recipients.push({
      audience: 'teacher',
      email: teacherProfile.email,
      recipientName: teacherName,
      counterpartName: studentName,
      lang: teacherProfile.preferred_language ?? 'es',
      timezone: safeZone(teacherProfile.timezone),
      prefs: teacherProfile.notification_preferences ?? null,
    })
  }
  if (recipients.length === 0) {
    // Nothing to schedule — clear the IDs column so we don't cancel stale ones on a later call.
    await admin.from('bookings').update({ scheduled_email_ids: [] }).eq('id', bookingId)
    return
  }

  // ── Immediate confirmation email + calendar invite (.ics) ──────────────────
  // Fires now (not scheduled): for the student this is their first email about
  // the class. The attached .ics drops the class into their calendar, which
  // then fires its own native reminders (VALARM -1d / -1h) — the $0,
  // no-external-API reminder backbone that lets us defer SMS/WhatsApp.
  //
  // A second-precision SEQUENCE means a reschedule / teacher re-assign re-sends
  // an invite that *updates* the existing calendar event (same UID, higher
  // SEQUENCE) instead of duplicating it.
  const durationMinutes = (booking as { duration_minutes?: number | null }).duration_minutes ?? 60
  const icsSequence = Math.floor(Date.now() / 1000)
  const organizerEmail = bareEmail(fromEmail)
  const confirmationJobs: Array<Promise<void>> = []
  for (const r of recipients) {
    // Honor an explicit email opt-out; otherwise this transactional confirmation sends.
    if (r.prefs && r.prefs.email === false) continue
    const roomUrl = `${appUrl}/${r.lang}/sala/${bookingId}`
    const ics = buildBookingIcs({
      bookingId,
      startIso: booking.scheduled_at,
      durationMinutes,
      summary: r.lang === 'es'
        ? `Clase de inglés con ${r.counterpartName}`
        : `English class with ${r.counterpartName}`,
      description: r.lang === 'es'
        ? `Tu clase de EnglishKolab. Entra aquí: ${roomUrl}`
        : `Your EnglishKolab class. Join here: ${roomUrl}`,
      location: roomUrl,
      organizerEmail,
      organizerName: 'EnglishKolab',
      attendeeEmail: r.email,
      attendeeName: r.recipientName,
      sequence: icsSequence,
    })
    confirmationJobs.push(sendConfirmationEmail({
      apiKey,
      from: fromEmail,
      to: r.email,
      subject: r.lang === 'es' ? 'Tu clase está confirmada' : 'Your class is confirmed',
      html: confirmationHtml({
        lang: r.lang,
        audience: r.audience,
        recipientName: r.recipientName,
        counterpartName: r.counterpartName,
        scheduled: formatScheduled(booking.scheduled_at, r.lang, r.timezone),
        appUrl,
        bookingId,
      }),
      icsBase64: Buffer.from(ics, 'utf-8').toString('base64'),
    }))
  }
  await Promise.all(confirmationJobs)

  const scheduledMs = new Date(booking.scheduled_at).getTime()
  const now = Date.now()

  const windows: Array<{ window: ReminderWindow; offsetMs: number }> = [
    { window: '24h', offsetMs: 24 * 60 * 60 * 1000 },
    { window: '1h',  offsetMs:  1 * 60 * 60 * 1000 },
  ]

  const jobs: Array<Promise<string | null>> = []
  for (const w of windows) {
    const fireAtMs = scheduledMs - w.offsetMs
    // Skip windows that would fire in the past (e.g. a booking confirmed
    // within 24h of the class — the 24h reminder is already stale).
    if (fireAtMs <= now + 60_000) continue
    const fireAtIso = new Date(fireAtMs).toISOString()
    for (const r of recipients) {
      // Honor the recipient's saved preferences (channel + this window's timing).
      if (!emailEnabledFor(r.prefs, w.window)) continue
      // Each recipient sees the time in their own zone + language. This is the
      // Phase D change: prior to this, both recipients got es-HN / Tegucigalpa
      // regardless of their profile settings.
      const scheduledPretty = formatScheduled(booking.scheduled_at, r.lang, r.timezone)
      jobs.push(scheduleOne({
        apiKey,
        from: fromEmail,
        to: r.email,
        subject: w.window === '24h'
          ? (r.lang === 'es' ? 'Tu clase es mañana' : 'Your class is tomorrow')
          : (r.lang === 'es' ? 'Tu clase empieza pronto' : 'Your class starts soon'),
        html: reminderHtml({
          lang: r.lang,
          audience: r.audience,
          window: w.window,
          recipientName: r.recipientName,
          counterpartName: r.counterpartName,
          scheduled: scheduledPretty,
          appUrl,
          bookingId,
        }),
        scheduledAtIso: fireAtIso,
      }))
    }
  }

  const results = await Promise.all(jobs)
  const ids = results.filter((id): id is string => !!id)

  await admin
    .from('bookings')
    .update({ scheduled_email_ids: ids })
    .eq('id', bookingId)
}

// Cancels any scheduled reminder emails for a booking. Called from the
// booking-decline and admin reschedule-approval paths. Fire-and-forget.
export async function cancelBookingReminders(bookingId: string): Promise<void> {
  if (!isResendConfigured()) return
  const apiKey = process.env.RESEND_API_KEY as string

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('scheduled_email_ids')
    .eq('id', bookingId)
    .maybeSingle()

  const ids = (booking as { scheduled_email_ids?: string[] | null } | null)?.scheduled_email_ids
  if (!ids || ids.length === 0) return

  await Promise.all(ids.map((id) => cancelOne(apiKey, id)))

  await admin
    .from('bookings')
    .update({ scheduled_email_ids: [] })
    .eq('id', bookingId)
}
