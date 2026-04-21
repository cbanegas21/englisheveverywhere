import { test, expect } from '@playwright/test'
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

/**
 * RLS privilege-escalation probe (2026-04-20 audit).
 *
 * pg_policies catalogue shows that `students.UPDATE`, `teachers.UPDATE`, and
 * `profiles.UPDATE` use only a USING clause (`auth.uid() = profile_id` /
 * `auth.uid() = id`) with WITH CHECK = NULL. In PostgreSQL that means USING
 * governs both which rows can be updated AND what the post-update row looks
 * like — but NOT which columns are touchable. There is no column-level GRANT
 * in the schema, so an authenticated student should, in theory, be able to
 * self-mutate ANY column on their own row.
 *
 * If these tests FAIL (the user update succeeds), we have critical launch
 * blockers:
 *
 *   1. students.classes_remaining — any student can set to any value → free
 *      classes without purchase
 *   2. teachers.is_active — an unapproved teacher could self-activate,
 *      bypassing admin approval
 *   3. teachers.hourly_rate — teacher could inflate their own rate
 *   4. profiles.role — user could escalate to 'admin' → full platform access
 *
 * Each test creates a throwaway user via service-role admin, signs in as that
 * user, attempts the bad update via the regular anon client (simulating the
 * browser), and verifies the sensitive column did NOT change.
 */

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface ThrowawayStudent {
  userId: string
  studentId: string
  email: string
  password: string
  userClient: SupabaseClient
  admin: SupabaseClient
  cleanup: () => Promise<void>
}

async function makeStudent(): Promise<ThrowawayStudent | null> {
  const admin = getAdmin()
  if (!admin) return null

  const stamp = Date.now() + Math.floor(Math.random() * 10000)
  const email = `e2e-rls-${stamp}@englishkolab.test`
  const password = 'RlsTest1234!'

  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `RLS Probe ${stamp}`, role: 'student' },
  })
  if (error || !created.user) return null
  const userId = created.user.id

  await admin.from('profiles').upsert(
    { id: userId, email, full_name: `RLS Probe ${stamp}`, role: 'student' },
    { onConflict: 'id' },
  )

  const { data: sRow } = await admin
    .from('students')
    .insert({ profile_id: userId, classes_remaining: 0, placement_test_done: true, intake_done: true, level: 'B1' })
    .select('id')
    .single()
  if (!sRow) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(url, anonKey)
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password })
  if (signInErr) return null

  return {
    userId, studentId: sRow.id, email, password, userClient, admin,
    cleanup: async () => { try { await admin.auth.admin.deleteUser(userId) } catch {} },
  }
}

test.describe('RLS privilege-escalation probes', () => {
  test('student cannot self-increment classes_remaining via RLS', async () => {
    const s = await makeStudent()
    test.skip(!s, 'admin creds unavailable — cannot provision fixture')

    const { error: updErr } = await s!.userClient
      .from('students')
      .update({ classes_remaining: 999 })
      .eq('profile_id', s!.userId)

    const { data: row } = await s!.admin
      .from('students')
      .select('classes_remaining')
      .eq('id', s!.studentId)
      .single()

    await s!.cleanup()

    expect(
      row?.classes_remaining,
      `LAUNCH BLOCKER: student was able to self-set classes_remaining via direct update. ` +
      `Current value = ${row?.classes_remaining}, expected to remain 0. ` +
      `RLS update error = ${updErr?.message ?? 'none'}`,
    ).toBe(0)
  })

  test('user cannot self-escalate profiles.role to admin via RLS', async () => {
    const s = await makeStudent()
    test.skip(!s, 'admin creds unavailable')

    const { error: updErr } = await s!.userClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', s!.userId)

    const { data: row } = await s!.admin
      .from('profiles')
      .select('role')
      .eq('id', s!.userId)
      .single()

    await s!.cleanup()

    expect(
      row?.role,
      `LAUNCH BLOCKER: user was able to self-promote to admin via direct profiles update. ` +
      `Current role = ${row?.role}, expected 'student'. ` +
      `RLS update error = ${updErr?.message ?? 'none'}`,
    ).toBe('student')
  })

  test('teacher cannot self-activate (set is_active=true) via RLS', async () => {
    const admin = getAdmin()
    test.skip(!admin, 'admin creds unavailable')

    const stamp = Date.now() + Math.floor(Math.random() * 10000)
    const email = `e2e-rls-teacher-${stamp}@englishkolab.test`
    const password = 'RlsTest1234!'

    const { data: created } = await admin!.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: `RLS Teacher Probe ${stamp}`, role: 'teacher' },
    })
    test.skip(!created?.user, 'user creation failed')
    const userId = created!.user!.id

    await admin!.from('profiles').upsert(
      { id: userId, email, full_name: `RLS Teacher Probe ${stamp}`, role: 'teacher' },
      { onConflict: 'id' },
    )
    const { data: tRow } = await admin!
      .from('teachers')
      .insert({ profile_id: userId, is_active: false, hourly_rate: 10 })
      .select('id')
      .single()

    const cleanup = async () => {
      try { await admin!.auth.admin.deleteUser(userId) } catch {}
    }

    if (!tRow) {
      await cleanup()
      test.skip(true, 'teacher row creation failed')
      return
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const userClient = createClient(url, anonKey)
    await userClient.auth.signInWithPassword({ email, password })

    const { error: updErr } = await userClient
      .from('teachers')
      .update({ is_active: true, hourly_rate: 999 })
      .eq('profile_id', userId)

    const { data: row } = await admin!
      .from('teachers')
      .select('is_active, hourly_rate')
      .eq('id', tRow.id)
      .single()

    await cleanup()

    expect(
      row?.is_active,
      `LAUNCH BLOCKER: teacher self-activated via direct update (bypassing admin approval). ` +
      `RLS error = ${updErr?.message ?? 'none'}`,
    ).toBe(false)

    expect(
      row?.hourly_rate,
      `LAUNCH BLOCKER: teacher self-inflated hourly_rate via direct update. ` +
      `Current value = ${row?.hourly_rate}, expected 10. ` +
      `RLS error = ${updErr?.message ?? 'none'}`,
    ).toBe(10)
  })
})
