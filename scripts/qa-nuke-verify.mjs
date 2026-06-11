// Post-nuke: clear the (bigint-id) auth_attempts log + verify both fresh logins
// actually authenticate. node --env-file=.env.local scripts/qa-nuke-verify.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// auth_attempts.id is bigint — clear with a numeric filter, not the UUID one.
const before = (await svc.from('auth_attempts').select('id', { count: 'exact', head: true })).count
const { error: aErr } = await svc.from('auth_attempts').delete().gte('id', 0)
const after = (await svc.from('auth_attempts').select('id', { count: 'exact', head: true })).count
console.log(`auth_attempts: ${before} -> ${after}${aErr ? '  ERROR: ' + aErr.message : ''}`)

// Real login test via the anon client (what the app actually uses).
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
for (const [email, password] of [['teacher@englishkolab.com', 'Teacher2026!'], ['student@englishkolab.com', 'Student2026!']]) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error) { console.log(`LOGIN ${email}: ✗ ${error.message}`); continue }
  const { data: prof } = await svc.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  console.log(`LOGIN ${email}: ✓ session ok, role=${prof?.role}`)
  await anon.auth.signOut()
}
