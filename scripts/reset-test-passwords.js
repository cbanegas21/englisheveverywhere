/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Reset passwords on the known test accounts to a stable value so the
 * Playwright E2E suite can log in. Idempotent — safe to re-run.
 *
 *   Student: testing@remoteacktive.com  → Test1234!
 *   Teacher: c.banegaspaz2020@gmail.com → Test1234!
 *
 * Usage:
 *   node scripts/reset-test-passwords.js
 */

const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
}

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TARGETS = [
  { email: 'testing@remoteacktive.com', label: 'student' },
  { email: 'c.banegaspaz2020@gmail.com', label: 'teacher' },
]
const NEW_PASSWORD = 'Test1234!'

async function run() {
  for (const { email, label } of TARGETS) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) {
      console.error(`[${label}] listUsers failed: ${error.message}`)
      continue
    }
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      console.error(`[${label}] not found: ${email}`)
      continue
    }
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: NEW_PASSWORD,
    })
    if (updateErr) {
      console.error(`[${label}] reset failed: ${updateErr.message}`)
    } else {
      console.log(`[${label}] reset OK: ${email}`)
    }
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
