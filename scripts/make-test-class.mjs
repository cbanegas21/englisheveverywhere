// Sandbox helper: spin up a confirmed class that's joinable RIGHT NOW (bypasses
// the 24h booking rule), between two test accounts, and print the join links +
// logins. Use it to test the live call on demand.
//
//   node --env-file=.env.local scripts/make-test-class.mjs
//   STUDENT=carlos_paz2020@outlook.com TEACHER=c.banegaspaz2020@gmail.com \
//     START_IN_MIN=0 DURATION=60 node --env-file=.env.local scripts/make-test-class.mjs
//
// Cleanup (remove all test bookings):
//   node --env-file=.env.local scripts/make-test-class.mjs --clean
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://englishkolab.com'

if (process.argv.includes('--clean')) {
  await sb.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true })
  console.log('all bookings deleted. bookings now:', count)
  process.exit(0)
}

const STUDENT = process.env.STUDENT || 'carlos_paz2020@outlook.com'
const TEACHER = process.env.TEACHER || 'c.banegaspaz2020@gmail.com' // TEACJHER (known pw Test1234!)
const startInMin = Number(process.env.START_IN_MIN ?? '0')
const duration = Number(process.env.DURATION ?? '60')

async function idFor(table, email) {
  const { data: p } = await sb.from('profiles').select('id').eq('email', email).single()
  if (!p) throw new Error(`no profile for ${email}`)
  const { data: row } = await sb.from(table).select('id').eq('profile_id', p.id).single()
  if (!row) throw new Error(`${email} is not a ${table.slice(0, -1)}`)
  return row.id
}

const studentId = await idFor('students', STUDENT)
const teacherId = await idFor('teachers', TEACHER)
const scheduled_at = new Date(Date.now() + startInMin * 60 * 1000).toISOString()

const { data: bk, error } = await sb.from('bookings').insert({
  student_id: studentId, teacher_id: teacherId, scheduled_at,
  duration_minutes: duration, status: 'confirmed', type: 'class',
}).select('id, scheduled_at').single()
if (error) { console.error('FAILED:', error.message); process.exit(1) }

const url = `${APP}/es/sala/${bk.id}`
console.log('\n✅ Test class created — joinable now' + (startInMin > 0 ? ` (lobby until +${startInMin} min)` : ' (live)'))
console.log('   booking:', bk.id, '| starts:', bk.scheduled_at, `| ${duration} min`)
console.log('\n   STUDENT  ', STUDENT, '  → log in, My Classes → Entrar a clase')
console.log('   TEACHER  ', TEACHER)
console.log('\n   Direct room link (either side, after login):\n   ' + url)
console.log('\n   Clean up when done:  node --env-file=.env.local scripts/make-test-class.mjs --clean\n')
