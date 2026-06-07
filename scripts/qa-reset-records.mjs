// Fresh-start cleanup: wipe transactional/activity records (bookings, sessions,
// payments, reschedule requests, assignment submissions, auth-attempt log).
// KEEPS accounts (profiles/students/teachers), plans, availability, library.
// node --env-file=.env.local scripts/qa-reset-records.mjs
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NONE = '00000000-0000-0000-0000-000000000000'

// FK-safe order: children that reference bookings first, then bookings.
const order = ['payments', 'assignment_submissions', 'reschedule_requests', 'sessions', 'bookings', 'auth_attempts']

async function count(t) {
  const { count } = await sb.from(t).select('id', { count: 'exact', head: true })
  return count
}

for (const t of order) {
  const before = await count(t)
  if (before === 0) { console.log(`${t}: 0 (skip)`); continue }
  const { error } = await sb.from(t).delete().neq('id', NONE)
  const after = await count(t)
  console.log(`${t}: ${before} -> ${after}${error ? '  ERROR: ' + error.message : ''}`)
}

console.log('\n=== KEPT (untouched) ===')
for (const t of ['profiles', 'students', 'teachers', 'plans', 'availability_slots', 'library_books']) {
  console.log(`${t}: ${await count(t)}`)
}
