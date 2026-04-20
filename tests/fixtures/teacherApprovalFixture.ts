/**
 * Fresh, throwaway teacher account for Tier 1.3 (approval flow) E2E tests.
 *
 * Creates a teacher with `is_active: false` so tests can:
 *   - assert the /maestro/pending redirect
 *   - simulate admin approval (set is_active=true) and reassert access
 *   - simulate admin rejection (delete teachers row + role='student')
 *
 * Mirrors the env-loading + service-role pattern from bookingFixture.ts.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

;(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
})()

export interface TeacherApprovalFixture {
  admin: SupabaseClient
  teacher: {
    email: string
    password: string
    userId: string
    teacherId: string
    fullName: string
  }
  setActive: (active: boolean) => Promise<void>
  deleteTeacherRow: () => Promise<void>
  setProfileRoleStudent: () => Promise<void>
  cleanup: () => Promise<void>
}

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function setupTeacherApprovalFixture(): Promise<TeacherApprovalFixture | null> {
  const admin = getAdmin()
  if (!admin) return null

  const stamp = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e-teacher-${stamp}@english-everywhere.test`
  const password = 'E2eTest1234!'
  const fullName = `E2E Pending Teacher ${stamp}`

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'teacher' },
  })
  if (error || !created.user) return null
  const userId = created.user.id

  await admin.from('profiles').upsert(
    { id: userId, email, full_name: fullName, role: 'teacher' },
    { onConflict: 'id' },
  )

  const { data: tRow, error: tErr } = await admin
    .from('teachers')
    .insert({ profile_id: userId, is_active: false, hourly_rate: 20 })
    .select('id')
    .single()
  if (tErr || !tRow) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return null
  }

  const cleanup = async () => {
    try {
      await admin.from('teachers').delete().eq('profile_id', userId)
      await admin.auth.admin.deleteUser(userId)
    } catch { /* best-effort */ }
  }

  return {
    admin,
    teacher: { email, password, userId, teacherId: tRow.id, fullName },
    setActive: async (active: boolean) => {
      await admin.from('teachers').update({ is_active: active }).eq('id', tRow.id)
    },
    deleteTeacherRow: async () => {
      await admin.from('teachers').delete().eq('id', tRow.id)
    },
    setProfileRoleStudent: async () => {
      await admin.from('profiles').update({ role: 'student' }).eq('id', userId)
    },
    cleanup,
  }
}
