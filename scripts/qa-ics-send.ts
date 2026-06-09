// One-off REAL test send: confirmation email + .ics attachment via Resend.
// Run: node --experimental-strip-types --env-file=.env.local scripts/qa-ics-send.ts
//
// External write — only run with Carlos's OK + a confirmed recipient.
import { buildBookingIcs } from '../src/lib/ics.ts'

const TO = 'admin@englishkolab.com'
const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM || 'noreply@englishkolab.com'
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://englishkolab.com'

if (!apiKey || apiKey === 're_placeholder') {
  console.error('RESEND_API_KEY missing or placeholder — aborting.')
  process.exit(1)
}

// A sample class ~2 days out so the calendar VALARMs (-1d / -1h) are in the future.
const start = new Date(Date.now() + 48 * 60 * 60 * 1000)
start.setUTCMinutes(0, 0, 0)
const startIso = start.toISOString()
const bookingId = 'qa-ics-demo'
const roomUrl = `${appUrl}/es/sala/${bookingId}`
const counterpartName = 'Lesly Castellanos'
const recipientName = 'Carlos'

const scheduledPretty = start.toLocaleString('es-HN', {
  weekday: 'long', month: 'long', day: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  timeZone: 'America/Tegucigalpa',
})

const ics = buildBookingIcs({
  bookingId,
  startIso,
  durationMinutes: 60,
  summary: `Clase de inglés con ${counterpartName}`,
  description: `Tu clase de EnglishKolab. Entra aquí: ${roomUrl}`,
  location: roomUrl,
  organizerEmail: from.match(/<([^>]+)>/)?.[1] || from,
  organizerName: 'EnglishKolab',
  attendeeEmail: TO,
  attendeeName: recipientName,
  sequence: Math.floor(Date.now() / 1000),
})

const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="color:#111;margin:0 0 8px 0">Tu clase está confirmada</h2>
    <p style="color:#4B5563;margin:0 0 16px 0">Hola ${recipientName},</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 16px 0">
      <tr><td style="padding:4px 0;color:#9CA3AF;font-size:13px">Cuándo</td><td style="padding:4px 0;color:#111;font-weight:600">${scheduledPretty}</td></tr>
      <tr><td style="padding:4px 0;color:#9CA3AF;font-size:13px">Con</td><td style="padding:4px 0;color:#111;font-weight:600">${counterpartName}</td></tr>
    </table>
    <p style="margin:24px 0 0 0">
      <a href="${roomUrl}" style="background:#C41E3A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Ir a la clase</a>
    </p>
    <p style="color:#6B7280;font-size:12px;margin:16px 0 0 0">Adjuntamos una invitación de calendario — ábrela para agregar la clase a tu calendario y recibir un recordatorio automático.</p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:32px">Con tu maestro ${counterpartName}</p>
    <p style="color:#C41E3A;font-size:11px;margin-top:24px">[ QA test — EnglishKolab .ics confirmation ]</p>
  </div>
`

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to: TO,
    subject: 'Tu clase está confirmada  [QA test]',
    html,
    attachments: [{
      filename: 'clase-englishkolab.ics',
      content: Buffer.from(ics, 'utf-8').toString('base64'),
      content_type: 'text/calendar',
    }],
  }),
})

const bodyText = await res.text()
console.log(`HTTP ${res.status}`)
console.log(bodyText)
process.exit(res.ok ? 0 : 1)
