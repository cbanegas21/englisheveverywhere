// Print the test student's upcoming bookings (id + schedule + status) so the
// call QA harness can navigate straight to /sala/[bookingId].
// Run with: node --env-file=.env.local scripts/qa-find-booking.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing supabase env'); process.exit(1) }

const sb = createClient(url, key, { auth: { persistSession: false } })

const EMAIL = 'carlos_paz2020@outlook.com'
const { data: prof, error: pe } = await sb.from('profiles').select('id, email, full_name, role').eq('email', EMAIL).single()
if (pe) { console.error('profile lookup failed:', pe.message); process.exit(1) }
console.log('student:', prof.id, prof.full_name, `(${prof.role})`)

const { data: stu, error: se } = await sb.from('students').select('id').eq('profile_id', prof.id).single()
if (se) { console.error('students lookup failed:', se.message); process.exit(1) }
console.log('students.id:', stu.id)

const { data: bookings, error: be } = await sb
  .from('bookings')
  .select('id, scheduled_at, status, type, duration_minutes, teacher_id')
  .eq('student_id', stu.id)
  .order('scheduled_at', { ascending: true })
if (be) { console.error('bookings lookup failed:', be.message); process.exit(1) }

for (const b of bookings) {
  console.log(JSON.stringify({ id: b.id, scheduled_at: b.scheduled_at, status: b.status, type: b.type, dur: b.duration_minutes, teacher: b.teacher_id }))
}
