// Create a test class booking: student carlos_paz2020 + teacher lecparos45,
// today 10:00 PM America/Tegucigalpa (UTC-6) → 04:00Z. Confirmed, 60 min.
// node --env-file=.env.local scripts/qa-create-booking.mjs
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const STUDENT_ID = '1c16c690-0ea5-4a82-ac6a-e0466d54e5c9' // students.id (carlos_paz2020)
const TEACHER_ID = 'eb0d520e-1a8c-4027-ae46-14594981a76a' // teachers.id (lecparos45 / Lesly C)
const scheduled_at = new Date('2026-06-06T22:00:00-06:00').toISOString()

const { data, error } = await sb.from('bookings').insert({
  student_id: STUDENT_ID,
  teacher_id: TEACHER_ID,
  scheduled_at,
  duration_minutes: 60,
  status: 'confirmed',
  type: 'class',
}).select('id, scheduled_at, status, type, duration_minutes').single()

if (error) { console.error('INSERT FAILED:', error.message); process.exit(1) }
console.log('CREATED booking:', JSON.stringify(data))
console.log('scheduled_at (UTC):', data.scheduled_at)
console.log('Student join URL: /es/sala/' + data.id)
