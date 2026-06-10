/**
 * AD-03 screenshot seed: insert ~5 TEMP bookings in the current week, write their
 * ids to a json file, so qa-unseed-calendar.mjs can delete them after capture.
 * Reversible, no credits touched. Run: node --env-file=.env.local scripts/qa-seed-calendar.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: student } = await sb.from('students').select('id, profile:profiles(full_name)').limit(1).single()
const { data: teacher } = await sb.from('teachers').select('id, profile:profiles(full_name)').eq('is_active', true).limit(1).single()
const { data: adminProf } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single()
if (!student) { console.error('no student row exists — cannot seed'); process.exit(1) }
if (!teacher) { console.error('no active teacher exists — cannot seed'); process.exit(1) }
console.log('student:', student.id, '| teacher:', teacher.id, '| adminProf:', adminProf?.id)

// Current week is Mon Jun 8 – Sun Jun 14 2026; Guatemala = UTC-6 (admin zone).
const liveStart = new Date(Date.now() - 10 * 60 * 1000).toISOString() // ~now, shows live pulse
const rows = [
  { student_id: student.id, teacher_id: null,        scheduled_at: '2026-06-11T15:00:00Z', duration_minutes: 60, status: 'pending',   type: 'class',          meeting_notes: '[AD-03 temp] unassigned' },
  { student_id: student.id, teacher_id: teacher.id,  scheduled_at: '2026-06-11T16:30:00Z', duration_minutes: 60, status: 'confirmed', type: 'class',          meeting_notes: '[AD-03 temp] confirmed' },
  { student_id: student.id, teacher_id: teacher.id,  scheduled_at: '2026-06-09T14:00:00Z', duration_minutes: 60, status: 'completed', type: 'class',          meeting_notes: '[AD-03 temp] completed' },
  { student_id: student.id, teacher_id: teacher.id,  scheduled_at: liveStart,              duration_minutes: 60, status: 'confirmed', type: 'class',          meeting_notes: '[AD-03 temp] live now' },
  { student_id: student.id, teacher_id: null,        scheduled_at: '2026-06-12T20:00:00Z', duration_minutes: 45, status: 'confirmed', type: 'placement_test', conductor_profile_id: adminProf?.id ?? null, meeting_notes: '[AD-03 temp] placement' },
]
const ids = []
for (const r of rows) {
  const { data, error } = await sb.from('bookings').insert(r).select('id').single()
  if (error) { console.error('insert failed:', r.meeting_notes, '->', error.message); continue }
  ids.push(data.id)
  console.log('seeded', data.id, '|', r.status, r.type, r.teacher_id ? 'assigned' : 'unassigned')
}
const OUT = join(tmpdir(), 'ad03-shots'); mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'seeded-ids.json'), JSON.stringify(ids))
console.log(`\nseeded ${ids.length} bookings; ids saved to ${join(OUT, 'seeded-ids.json')}`)
