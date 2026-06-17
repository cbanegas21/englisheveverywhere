// BREAK-GLASS: reset an admin's TOTP 2FA when the authenticator device is lost
// (P2-2). Supabase TOTP has no built-in recovery codes, so this is the recovery
// path: it deletes the user's verified MFA factor(s) via the GoTrue admin API so
// the admin can log in (password still works) and RE-ENROLL at /admin/seguridad.
//
// Usage (needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local):
//   node scripts/admin-2fa-reset.mjs admin@englishkolab.com           # list factors (dry run)
//   node scripts/admin-2fa-reset.mjs admin@englishkolab.com --delete  # actually delete them
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]
const doDelete = process.argv.includes('--delete')
if (!email) { console.error('Usage: node scripts/admin-2fa-reset.mjs <email> [--delete]'); process.exit(1) }
if (!SUPA || !SRK) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }

// find the user by email
const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: H }).then(r => r.json())
const user = (list.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase())
if (!user) { console.error(`No user found for ${email}`); process.exit(1) }
console.log(`User ${email} → id ${user.id}`)

// list factors
const factorsRes = await fetch(`${SUPA}/auth/v1/admin/users/${user.id}/factors`, { headers: H })
const factors = await factorsRes.json()
const arr = Array.isArray(factors) ? factors : (factors.factors || [])
if (!arr.length) { console.log('No MFA factors enrolled — nothing to reset.'); process.exit(0) }
for (const f of arr) console.log(`  factor ${f.id}  type=${f.factor_type}  status=${f.status}  friendly=${f.friendly_name || '-'}`)

if (!doDelete) { console.log('\n(dry run) re-run with --delete to remove these factors.'); process.exit(0) }
for (const f of arr) {
  const d = await fetch(`${SUPA}/auth/v1/admin/users/${user.id}/factors/${f.id}`, { method: 'DELETE', headers: H })
  console.log(`  deleted ${f.id} → http ${d.status}`)
}
console.log('\n✅ Factors removed. The admin can now log in (password) and re-enroll 2FA at /admin/seguridad.')
