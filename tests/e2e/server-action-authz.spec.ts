import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Server-action authz regression guards.
 *
 * Findings from the 2026-04-20 server-action audit. Each test is a static-
 * source assertion — reads the action source and checks for the defensive
 * check that MUST be present before calling the write path. If the check is
 * ever removed or the function is rewritten without it, this test flips red
 * before a regression lands in prod.
 *
 * Behavior tests (Playwright against live server) would be ideal, but the
 * authz logic is a simple presence-of-guard check — a static test is
 * proportionate to the risk and runs without needing a full DB fixture.
 */

test.describe('Server-action authz guards', () => {
  test('video.ts:saveSessionNotes must verify caller owns the session', async () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/actions/video.ts'),
      'utf8',
    )

    // Locate the saveSessionNotes function body.
    const match = src.match(/export async function saveSessionNotes\([\s\S]*?^\}/m)
    expect(match, 'saveSessionNotes function must exist in video.ts').toBeTruthy()
    const body = match![0]

    // Must look up the session by id and verify the caller is the teacher of
    // the booking that owns this session. Acceptable signatures:
    //   - a SELECT against `sessions` joined with `bookings`/`teachers` that
    //     compares against user.id
    //   - an explicit `if (teacherProfileId !== user.id)` style gate
    const fetchesSession = /from\(['"]sessions['"]\)[\s\S]*?\.eq\(['"]id['"]\s*,\s*sessionId\)/.test(body)
    const checksOwnership =
      /user\.id\s*!==?\s*\w*teacher\w*|teacher\w*\s*!==?\s*user\.id|user\.id\s*!==?\s*.*profile/i.test(body)

    expect(
      fetchesSession,
      'saveSessionNotes must fetch the session row to validate ownership before writing',
    ).toBe(true)

    expect(
      checksOwnership,
      'saveSessionNotes must gate the write behind a teacher-ownership check. ' +
      'Currently any authenticated user can overwrite any session\'s notes by passing a session id.',
    ).toBe(true)
  })

  test('stripe.ts:createStripeConnectLink must verify caller is an approved teacher', async () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/actions/stripe.ts'),
      'utf8',
    )

    // Locate the createStripeConnectLink function body.
    const match = src.match(/export async function createStripeConnectLink\([\s\S]*?^\}/m)
    expect(match, 'createStripeConnectLink function must exist in stripe.ts').toBeTruthy()
    const body = match![0]

    // Must return early if the caller isn't a teacher. A `.single()` that
    // returns null for non-teachers is NOT enough — the current code proceeds
    // to `stripe.accounts.create` even when `teacher` is null, because the
    // null-check is only used to decide whether to create-vs-reuse.
    //
    // Acceptable signatures for a proper teacher gate:
    //   - `if (!teacher) return { error: ... }` BEFORE the stripe.accounts.create call
    //   - check profile.role === 'teacher' up front
    //   - use .single() without maybeSingle so a missing row throws
    const hasEarlyReturnForNonTeacher =
      /if\s*\(\s*!teacher\s*\)\s*(return|throw)|profile\??.role\s*!==?\s*['"]teacher['"]|role\s*!==?\s*['"]teacher['"]/.test(body)

    expect(
      hasEarlyReturnForNonTeacher,
      'createStripeConnectLink must return an error if the caller is not a teacher. ' +
      'Currently a student user could trigger stripe.accounts.create, creating orphan ' +
      'Stripe Connect accounts linked to their email.',
    ).toBe(true)
  })
})
