// One-off: grant a test student a 20-class "peak" plan for QA/testing.
// Reports BEFORE/AFTER. Usage: node scripts/add-test-plan.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const here = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(here, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1) }
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const EMAIL = 'carlos_paz2020@outlook.com'
const PLAN = 'peak'
const CLASSES = 20

const { data: list, error: lErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (lErr) { console.error('listUsers failed:', lErr.message); process.exit(1) }
const u = list.users.find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase())
if (!u) { console.error('User NOT FOUND:', EMAIL); process.exit(1) }
console.log('user:', EMAIL, '| id:', u.id, '| confirmed:', !!u.email_confirmed_at)

const { data: prof } = await supabase.from('profiles').select('role, full_name').eq('id', u.id).maybeSingle()
console.log('profile:', JSON.stringify(prof))

const { data: before, error: sErr } = await supabase.from('students').select('*').eq('profile_id', u.id).maybeSingle()
if (sErr) { console.error('students query failed:', sErr.message); process.exit(1) }
if (!before) { console.error('NO students row for this user — cannot grant a plan without one. Aborting (no write).'); process.exit(2) }
const slim = (s) => ({ id: s.id, current_plan: s.current_plan, classes_remaining: s.classes_remaining, intake_done: s.intake_done, placement_test_done: s.placement_test_done, current_level: s.current_level })
console.log('BEFORE:', JSON.stringify(slim(before)))

const patch = { current_plan: PLAN, classes_remaining: CLASSES }
if (before.intake_done === false) patch.intake_done = true
console.log('PATCH:', JSON.stringify(patch))

const { data: after, error: uErr } = await supabase.from('students').update(patch).eq('profile_id', u.id).select('*').maybeSingle()
if (uErr) { console.error('UPDATE failed:', uErr.message); process.exit(1) }
console.log('AFTER:', JSON.stringify(slim(after)))
console.log('DONE')
