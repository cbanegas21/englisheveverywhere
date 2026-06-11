// DESTRUCTIVE — fresh start. Wipes every account except admin@englishkolab.com,
// then creates 2 clean foundation logins (teacher + student). Run ONLY on
// Carlos's explicit "execute". Mirrors qa-reset-records' delete pattern.
//   node --env-file=.env.local scripts/qa-nuke-execute.mjs
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NONE = '00000000-0000-0000-0000-000000000000'
const KEEP = 'admin@englishkolab.com'

const count = async (t) => (await sb.from(t).select('id', { count: 'exact', head: true })).count
async function wipe(t) {
  const before = await count(t)
  if (!before) { console.log(`  ${t}: 0 (skip)`); return }
  const { error } = await sb.from(t).delete().neq('id', NONE)
  console.log(`  ${t}: ${before} -> ${await count(t)}${error ? '  ERROR: ' + error.message : ''}`)
}

// ── Safety: confirm the keep-account exists before we delete anything ──────────
const { data: adminProf } = await sb.from('profiles').select('id, email, role').eq('email', KEEP).maybeSingle()
if (!adminProf) { console.error(`ABORT: keep-account ${KEEP} not found — refusing to delete.`); process.exit(1) }
if (adminProf.role !== 'admin') { console.error(`ABORT: ${KEEP} is role=${adminProf.role}, expected admin.`); process.exit(1) }
console.log(`Keep-account OK: ${KEEP} (${adminProf.id})\n`)

// ── 1. Clear activity + dependent rows (FK-safe: children first) ──────────────
console.log('Wiping activity + dependent rows:')
for (const t of ['payments', 'assignment_submissions', 'assignments', 'reschedule_requests', 'sessions', 'bookings', 'subscriptions', 'availability_slots', 'auth_attempts']) {
  await wipe(t)
}

// ── 2. Delete student + teacher rows (students first: primary_teacher_id → teachers) ──
console.log('\nWiping student/teacher rows:')
await wipe('students')
await wipe('teachers')

// ── 3. Delete every non-admin profile, then its auth user ─────────────────────
console.log('\nDeleting non-admin profiles + auth users:')
const { error: profErr } = await sb.from('profiles').delete().neq('id', adminProf.id)
console.log(`  profiles: kept admin, deleted the rest${profErr ? '  ERROR: ' + profErr.message : ''}`)

const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
for (const u of list.users) {
  if (u.email?.toLowerCase() === KEEP.toLowerCase()) continue
  const { error } = await sb.auth.admin.deleteUser(u.id)
  console.log(`  auth delete ${u.email}${error ? '  ERROR: ' + error.message : '  ✓'}`)
}

// ── 4. Create the 2 fresh foundation logins ───────────────────────────────────
console.log('\nCreating foundation accounts:')
async function createAccount({ email, password, fullName, role }) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, role, preferred_language: 'es', timezone: 'America/Tegucigalpa' },
  })
  if (error) { console.log(`  ✗ ${email}: ${error.message}`); return null }
  const id = data.user.id
  // Trigger created the profile (id/email/full_name/role). Fill realism fields.
  await sb.from('profiles').update({ preferred_language: 'es', timezone: 'America/Tegucigalpa' }).eq('id', id)
  console.log(`  ✓ ${email} (${role}) ${id}`)
  return id
}

const teacherId = await createAccount({ email: 'teacher@englishkolab.com', password: 'Teacher2026!', fullName: 'QA Teacher', role: 'teacher' })
if (teacherId) {
  const { error } = await sb.from('teachers').insert({ profile_id: teacherId, is_active: true, accepting_students: true, hourly_rate: 25 })
  console.log(`    teacher row: ${error ? 'ERROR ' + error.message : 'created (active, $25/h)'}`)
}

const studentId = await createAccount({ email: 'student@englishkolab.com', password: 'Student2026!', fullName: 'QA Student', role: 'student' })
if (studentId) {
  const { error } = await sb.from('students').insert({ profile_id: studentId, intake_done: true, current_plan: 'peak', classes_remaining: 20, placement_test_done: false })
  console.log(`    student row: ${error ? 'ERROR ' + error.message : 'created (intake done, peak plan, 20 classes)'}`)
}

// ── 5. Verify final state ─────────────────────────────────────────────────────
console.log('\n=== FINAL STATE ===')
const { data: finalProfs } = await sb.from('profiles').select('email, role, full_name').order('role')
for (const p of (finalProfs || [])) console.log(`  ${p.role.padEnd(8)} ${p.full_name}  <${p.email}>`)
console.log(`\n  profiles: ${await count('profiles')} | students: ${await count('students')} | teachers: ${await count('teachers')} | bookings: ${await count('bookings')} | plans: ${await count('plans')} (untouched)`)
console.log('\nDONE.')
