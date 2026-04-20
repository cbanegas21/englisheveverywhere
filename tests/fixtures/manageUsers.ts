/**
 * Small helpers that use the Supabase service-role key to keep the
 * test accounts in known-good state:
 *
 *   - ensureStudentPassword(): resets the static student's password back
 *     to the documented value (Test1234!) so dashboard tests can log in
 *     even after manual prod poking drifts it.
 *
 *   - ensureAdminUser(): idempotently provisions (or resets) a dedicated
 *     admin test account with role='admin', returning its creds.
 *
 * Both return null if the service-role key or URL is missing, so tests
 * can `test.skip` gracefully on machines without the full env.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* .env.local optional */ }
})()

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function findUserByEmail(db: SupabaseClient, email: string) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const hit = data.users.find(u => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

export async function ensureStudentPassword(email: string, password: string): Promise<boolean> {
  const db = admin()
  if (!db) return false
  const user = await findUserByEmail(db, email)
  if (!user) return false
  const { error } = await db.auth.admin.updateUserById(user.id, { password })
  return !error
}

export interface AdminCreds { email: string; password: string }

const ADMIN_EMAIL = 'e2e-admin@english-everywhere.test'
const ADMIN_PASSWORD = 'E2eAdmin1234!'

export async function ensureAdminUser(): Promise<AdminCreds | null> {
  const db = admin()
  if (!db) return null

  let user = await findUserByEmail(db, ADMIN_EMAIL)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Admin', role: 'admin' },
    })
    if (error || !data.user) return null
    user = data.user
  } else {
    // Reset password so rotations don't break the suite.
    await db.auth.admin.updateUserById(user.id, { password: ADMIN_PASSWORD })
  }

  // The handle_new_user trigger may have set role='student'; force to 'admin'.
  const { error: pErr } = await db
    .from('profiles')
    .upsert(
      { id: user.id, email: ADMIN_EMAIL, full_name: 'E2E Admin', role: 'admin' },
      { onConflict: 'id' },
    )
  if (pErr) return null

  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
}
