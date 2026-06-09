// QA for the .ics generator — pure, no network, no DB.
// Run: node --experimental-strip-types scripts/qa-ics.ts
import { buildBookingIcs } from '../src/lib/ics.ts'

let failures = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

const start = '2026-06-10T17:00:00.000Z'
const ics = buildBookingIcs({
  bookingId: 'abc-123',
  startIso: start,
  durationMinutes: 60,
  // deliberately include comma + semicolon to exercise escaping
  summary: 'Clase de inglés con Lesly, nivel B1; conversación',
  description: 'Tu clase de EnglishKolab. Entra aquí: https://englishkolab.com/es/sala/abc-123',
  location: 'https://englishkolab.com/es/sala/abc-123',
  organizerEmail: 'noreply@englishkolab.com',
  organizerName: 'EnglishKolab',
  attendeeEmail: 'carlos@example.com',
  attendeeName: 'Carlos',
  sequence: 1717000000,
})

console.log('\n----- generated .ics -----')
process.stdout.write(ics)
console.log('--------------------------\n')

check('wrapped in VCALENDAR', ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'))
check('METHOD:REQUEST present', ics.includes('METHOD:REQUEST'))
check('UID carries bookingId', ics.includes('UID:booking-abc-123@englishkolab.com'))
check('SEQUENCE present', ics.includes('SEQUENCE:1717000000'))
check('DTSTART is UTC basic form', ics.includes('DTSTART:20260610T170000Z'))
check('DTEND = start + 60min', ics.includes('DTEND:20260610T180000Z'))
check('comma escaped in SUMMARY', ics.includes('Lesly\\,'))
check('semicolon escaped in SUMMARY', ics.includes('B1\\;'))
check('24h VALARM present', ics.includes('TRIGGER:-P1D'))
check('1h VALARM present', ics.includes('TRIGGER:-PT1H'))
check('two VALARM blocks', (ics.match(/BEGIN:VALARM/g) || []).length === 2)
check('CRLF line endings', ics.includes('\r\n') && !ics.includes('\n\n'))
check('ORGANIZER mailto', ics.includes('ORGANIZER;CN=EnglishKolab:mailto:noreply@englishkolab.com'))
check('ATTENDEE rsvp', ics.includes('ATTENDEE;CN=Carlos;RSVP=TRUE:mailto:carlos@example.com'))

// Long line folding: continuation lines must start with a space.
const longestRaw = ics.split('\r\n').reduce((m, l) => Math.max(m, l.length), 0)
check('no unfolded line over 75 octets', longestRaw <= 75)

console.log(`\n${failures === 0 ? 'ALL GREEN' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
