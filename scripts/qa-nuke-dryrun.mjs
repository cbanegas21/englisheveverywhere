// READ-ONLY dry run for the "fresh start" nuke.
// Shows exactly which accounts would be DELETED vs KEPT, and the dependent rows
// that would cascade — touches NOTHING. Run:
//   node --env-file=.env.local scripts/qa-nuke-dryrun.mjs
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const KEEP_EMAILS = ['admin@englishkolab.com'] // the only always-on account

const { data: profs } = await sb.from('profiles').select('id, email, full_name, role').order('role')
const keep = []
const drop = []
for (const p of (profs || [])) (KEEP_EMAILS.includes(p.email) ? keep : drop).push(p)

async function countFor(p) {
  const c = {}
  if (p.role === 'student') {
    const { data: s } = await sb.from('students').select('id').eq('profile_id', p.id).maybeSingle()
    if (s) {
      const { count: bk } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('student_id', s.id)
      c.bookings = bk || 0
    }
  } else if (p.role === 'teacher') {
    const { data: t } = await sb.from('teachers').select('id').eq('profile_id', p.id).maybeSingle()
    if (t) {
      const { count: bk } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('teacher_id', t.id)
      const { count: av } = await sb.from('availability_slots').select('id', { count: 'exact', head: true }).eq('teacher_id', t.id)
      c.bookings = bk || 0
      c.availability_slots = av || 0
    }
  }
  return c
}

console.log('================  DRY RUN — NOTHING DELETED  ================\n')
console.log('KEEP (always-on):')
for (const p of keep) console.log(`  ✅ ${p.role.padEnd(8)} ${p.full_name}  <${p.email}>`)

console.log('\nDELETE (auth user + profile + the cascade below):')
for (const p of drop) {
  const c = await countFor(p)
  const extra = Object.entries(c).map(([k, v]) => `${k}=${v}`).join(', ')
  console.log(`  ❌ ${p.role.padEnd(8)} ${p.full_name}  <${p.email}>${extra ? '   [' + extra + ']' : ''}`)
}

console.log('\nTHEN CREATE (the 2 fresh foundation logins):')
console.log('  ➕ teacher   QA Teacher   <teacher@englishkolab.com>   (active, approved)')
console.log('  ➕ student   QA Student   <student@englishkolab.com>   (intake done, granted a plan)')

console.log(`\nResult: ${keep.length} kept + 2 created = ${keep.length + 2} accounts total.`)
console.log('Plans (pricing) are NOT touched. auth_attempts log will be cleared too.')
console.log('\n============================================================')
