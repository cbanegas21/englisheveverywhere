// Minimal, dependency-free iCalendar (.ics) generator for booking confirmations.
//
// We attach one of these to the booking-confirmation email so the class lands
// directly in the student's (and teacher's) calendar — which then fires its OWN
// native reminders (VALARM at -1 day and -1 hour). This gives reliable, $0,
// no-external-API reminders layered on top of the Resend email reminders, and
// is what lets us defer the paid SMS / WhatsApp channels.
//
// Updates (reschedule, teacher re-assign) reuse the same UID with a higher
// SEQUENCE, so calendar clients update the existing event in place instead of
// creating a duplicate. METHOD:REQUEST presents it as a meeting invitation.
//
// RFC 5545 is followed closely enough for Gmail / Apple Calendar / Outlook to
// accept the file and offer "Add to calendar": CRLF line endings, UTC
// date-times, text escaping (§3.3.11) and 75-octet line folding (§3.1).

type IcsEvent = {
  bookingId: string
  startIso: string
  durationMinutes: number
  summary: string
  description: string
  location: string
  organizerEmail: string
  organizerName: string
  attendeeEmail: string
  attendeeName: string
  // Monotonically-increasing revision number; the highest SEQUENCE wins when a
  // client receives an update for the same UID.
  sequence: number
}

// Escape TEXT values per RFC 5545 §3.3.11: backslash, semicolon, comma, newline.
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545 UTC date-time form: YYYYMMDDTHHMMSSZ
function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Fold content lines to <= 75 octets (§3.1). Continuation lines begin with a
// single space. We fold on character count at 73 — for our ASCII URLs/labels
// that stays under the octet limit; the rare accented name only ever nudges a
// fold slightly and every major client unfolds it correctly.
function fold(line: string): string {
  if (line.length <= 73) return line
  const chunks: string[] = []
  for (let i = 0; i < line.length; i += 73) {
    chunks.push((i === 0 ? '' : ' ') + line.slice(i, i + 73))
  }
  return chunks.join('\r\n')
}

export function buildBookingIcs(ev: IcsEvent): string {
  const start = new Date(ev.startIso)
  const end = new Date(start.getTime() + ev.durationMinutes * 60 * 1000)
  const uid = `booking-${ev.bookingId}@englishkolab.com`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EnglishKolab//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${ev.sequence}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${esc(ev.summary)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    `URL:${esc(ev.location)}`,
    `ORGANIZER;CN=${esc(ev.organizerName)}:mailto:${ev.organizerEmail}`,
    `ATTENDEE;CN=${esc(ev.attendeeName)};RSVP=TRUE:mailto:${ev.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    // Native calendar reminders — the whole reason we attach this.
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(ev.summary)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(ev.summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // CRLF-terminated, with a trailing CRLF after END:VCALENDAR.
  return lines.map(fold).join('\r\n') + '\r\n'
}
