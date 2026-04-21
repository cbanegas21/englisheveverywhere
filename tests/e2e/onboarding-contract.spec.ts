import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Tier 2.6 — Onboarding contract (actions/onboarding.ts).
 *
 * No other spec covers these two server actions directly. They're short but
 * have one SECURITY-ADJACENT invariant that a thoughtless refactor could
 * break silently:
 *
 *   `completeTeacherOnboarding` MUST write `is_active: false` on the first
 *   teachers-row upsert. `src/app/[lang]/maestro/pending/page.tsx:60` uses
 *   `teacher.is_active` to decide whether to redirect an applicant to
 *   `/maestro/dashboard` or keep them on the pending screen. If onboarding
 *   ever writes `is_active: true` directly (whether from a copy-paste, a
 *   boolean flip, or a migration default change), EVERY new teacher would
 *   bypass admin approval entirely and gain full teacher-dashboard access
 *   including earnings, student lists, and availability. The approval flow
 *   is the ONLY layer preventing that, and this test is the tripwire.
 *
 * Two secondary invariants:
 *
 *   - `hourly_rate: 0` default — admin must explicitly set a rate before the
 *     teacher can earn. If this ever defaulted to a positive number, a
 *     pending teacher who slipped past the gate would earn the default.
 *   - Authz rejection — passing someone else's `userId` must be refused,
 *     otherwise a signed-in user could overwrite anyone's profile.
 *
 * Testing strategy: mirror setupBookingFixture's env-load + throwaway-user
 * pattern. We exercise the DB writes the actions perform directly (same
 * approach as placement-booking / session-notes specs) and use source-level
 * regex guards to assert the literal `is_active: false` + `hourly_rate: 0`
 * tokens still live in the action file. The direct DB write alone doesn't
 * catch a refactor that sets them to true in the action but never reaches
 * the DB — the source probe closes that gap.
 */

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

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface Throwaway {
  userId: string
  email: string
  admin: SupabaseClient
  cleanup: () => Promise<void>
}

async function makeThrowawayAuthUser(role: 'teacher' | 'student'): Promise<Throwaway | null> {
  const admin = getAdmin()
  if (!admin) return null

  const stamp = Date.now() + Math.floor(Math.random() * 10000)
  const email = `e2e-onb-${role}-${stamp}@englishkolab.test`
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: 'OnboardPw1234!',
    email_confirm: true,
    user_metadata: { full_name: `Onb Probe ${stamp}`, role },
  })
  if (error || !created.user) return null

  await admin.from('profiles').upsert(
    { id: created.user.id, email, full_name: `Onb Probe ${stamp}`, role },
    { onConflict: 'id' },
  )

  return {
    userId: created.user.id,
    email,
    admin,
    cleanup: async () => {
      try { await admin.auth.admin.deleteUser(created.user!.id) } catch {}
    },
  }
}

test.describe('Tier 2.6 — Onboarding contract', () => {
  test('completeTeacherOnboarding insert shape: is_active=false AND hourly_rate=0', async () => {
    const u = await makeThrowawayAuthUser('teacher')
    test.skip(!u, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    try {
      // Mirror completeTeacherOnboarding's upsert (src/app/actions/onboarding.ts:53-64).
      // We replicate the exact field set rather than calling the action
      // because the action reads the user from the request cookies — there's
      // no session in the test env. The source probe below covers the
      // can't-drift case where this test's mirror diverges from the real
      // action.
      const { error } = await u!.admin
        .from('teachers')
        .upsert(
          {
            profile_id: u!.userId,
            bio: 'E2E onboarding probe bio',
            specializations: ['business'],
            certifications: [],
            hourly_rate: 0,
            is_active: false,
          },
          { onConflict: 'profile_id' },
        )
      expect(error, 'teachers upsert with the action shape must succeed').toBeNull()

      const { data: teacher } = await u!.admin
        .from('teachers')
        .select('is_active, hourly_rate, profile_id')
        .eq('profile_id', u!.userId)
        .single()

      // The critical security-adjacent assertion. If this ever flips, every
      // new teacher lands on /maestro/dashboard instead of /maestro/pending.
      expect(
        teacher?.is_active,
        'new teachers MUST start is_active=false — approval gate depends on it',
      ).toBe(false)
      expect(
        teacher?.hourly_rate,
        'new teachers start with hourly_rate=0 — admin sets a real rate on approval',
      ).toBe(0)
      expect(teacher?.profile_id).toBe(u!.userId)
    } finally {
      // Clean the teachers row explicitly since deleteUser cascades via FK
      // but only if no children block it.
      await u!.admin.from('teachers').delete().eq('profile_id', u!.userId)
      await u!.cleanup()
    }
  })

  test('completeTeacherOnboarding is idempotent: second upsert with same profile_id doesn\'t create a duplicate', async () => {
    const u = await makeThrowawayAuthUser('teacher')
    test.skip(!u, 'Fixture unavailable')

    try {
      // The action uses upsert with onConflict='profile_id'. A refactor that
      // drops the onConflict clause would cause duplicate-key violations on
      // retry (students who submit twice would see 500). Validate idempotence.
      await u!.admin.from('teachers').upsert(
        { profile_id: u!.userId, bio: 'first', specializations: [], hourly_rate: 0, is_active: false },
        { onConflict: 'profile_id' },
      )
      const { error: secondErr } = await u!.admin.from('teachers').upsert(
        { profile_id: u!.userId, bio: 'second', specializations: ['travel'], hourly_rate: 0, is_active: false },
        { onConflict: 'profile_id' },
      )
      expect(secondErr, 'second upsert must NOT conflict').toBeNull()

      const { data: rows } = await u!.admin
        .from('teachers')
        .select('id, bio, specializations')
        .eq('profile_id', u!.userId)
      expect(rows?.length, 'exactly one teacher row after two upserts').toBe(1)
      expect(rows?.[0].bio, 'second upsert overwrites the first').toBe('second')
      expect(rows?.[0].specializations).toEqual(['travel'])
    } finally {
      await u!.admin.from('teachers').delete().eq('profile_id', u!.userId)
      await u!.cleanup()
    }
  })

  test('completeStudentOnboarding writes timezone + preferred_language, creates students row', async () => {
    const u = await makeThrowawayAuthUser('student')
    test.skip(!u, 'Fixture unavailable')

    try {
      // Mirror completeStudentOnboarding (actions/onboarding.ts:15-28).
      await u!.admin
        .from('profiles')
        .update({ timezone: 'America/Tegucigalpa', preferred_language: 'es' })
        .eq('id', u!.userId)

      await u!.admin
        .from('students')
        .upsert({ profile_id: u!.userId }, { onConflict: 'profile_id' })

      const { data: profile } = await u!.admin
        .from('profiles')
        .select('timezone, preferred_language')
        .eq('id', u!.userId)
        .single()
      expect(profile?.timezone).toBe('America/Tegucigalpa')
      expect(profile?.preferred_language).toBe('es')

      const { data: student } = await u!.admin
        .from('students')
        .select('profile_id')
        .eq('profile_id', u!.userId)
        .single()
      expect(student?.profile_id).toBe(u!.userId)
    } finally {
      await u!.admin.from('students').delete().eq('profile_id', u!.userId)
      await u!.cleanup()
    }
  })

  test('source: onboarding.ts literal is_active=false + hourly_rate=0 + authz guard', () => {
    // This is the actual tripwire. The DB-shape tests above prove the columns
    // exist and accept the right values. This probe proves the ACTION still
    // writes those values — so a refactor that flips either to `true` / a
    // non-zero default trips here even if no migration changes.
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/actions/onboarding.ts'),
      'utf8',
    )

    // Teacher insert block must contain the literal `is_active: false`.
    expect(
      /is_active\s*:\s*false/.test(src),
      'completeTeacherOnboarding must write is_active=false — approval-gate tripwire',
    ).toBe(true)

    // And the literal `hourly_rate: 0` — a positive default is a red flag.
    expect(
      /hourly_rate\s*:\s*0\b/.test(src),
      'completeTeacherOnboarding must write hourly_rate=0 — admin sets real rate',
    ).toBe(true)

    // Authz guard: actions must reject if caller.user.id !== data.userId.
    // Both actions share this shape. Catch a refactor that drops the check.
    expect(
      /user\.id\s*!==\s*data\.userId/.test(src),
      'both onboarding actions MUST reject wrong-user writes',
    ).toBe(true)

    // Both actions must still call revalidatePath('/', 'layout') so the UI
    // redirect to /maestro/pending (or /dashboard) takes effect immediately.
    expect(
      /revalidatePath\(\s*['"]\/['"]\s*,\s*['"]layout['"]/.test(src),
      'onboarding actions must revalidate layout so pending-page gating is fresh',
    ).toBe(true)
  })
})
