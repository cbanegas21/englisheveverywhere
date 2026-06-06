// READ-ONLY: list known test accounts with their role + confirmed state.
// No writes. Usage: node scripts/check-accounts.mjs
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

const EMAILS = [
  'admin@englishkolab.com',
  'lesly@englishkolab.com',
  'c.banegaspaz2020@gmail.com',
  'testing@remoteacktive.com',
]
const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 300 })
if (error) { console.error('listUsers failed:', error.message); process.exit(1) }

for (const email of EMAILS) {
  const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
  if (!u) { console.log(`${email.padEnd(32)} | NOT FOUND`); continue }
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).maybeSingle()
  let active = ''
  if (prof?.role === 'teacher') {
    const { data: t } = await supabase.from('teachers').select('is_active').eq('profile_id', u.id).maybeSingle()
    active = ` | is_active=${t ? t.is_active : 'no teacher row'}`
  }
  console.log(`${email.padEnd(32)} | exists | confirmed=${!!u.email_confirmed_at} | role=${prof?.role ?? '?'}${active}`)
}

console.log('--- all admins in DB ---')
const { data: admins, error: aErr } = await supabase.from('profiles').select('id, full_name').eq('role', 'admin')
if (aErr) console.log('admin query failed:', aErr.message)
else if (!admins || admins.length === 0) console.log('(no admin profiles found)')
else for (const a of admins) {
  const u = data.users.find((x) => x.id === a.id)
  console.log(`admin: ${(u?.email ?? a.id)} | confirmed=${u ? !!u.email_confirmed_at : '?'} | name=${a.full_name ?? ''}`)
}

console.log('--- all teachers in DB ---')
const { data: teachers } = await supabase.from('teachers').select('profile_id, is_active')
for (const t of (teachers ?? [])) {
  const u = data.users.find((x) => x.id === t.profile_id)
  console.log(`teacher: ${(u?.email ?? t.profile_id)} | is_active=${t.is_active}`)
}

console.log(`--- ALL users (${data.users.length}) ---`)
const { data: allProfs } = await supabase.from('profiles').select('id, role')
const roleById = Object.fromEntries((allProfs ?? []).map((p) => [p.id, p.role]))
for (const u of [...data.users].sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))) {
  console.log(`${(u.email ?? '(no email)').padEnd(36)} | role=${roleById[u.id] ?? '?'} | confirmed=${!!u.email_confirmed_at}`)
}
