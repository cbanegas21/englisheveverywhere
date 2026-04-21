import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  setupBookingFixture,
  insertBooking,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 2.3 — saveSessionNotes contract.
 *
 * The teacher's Notas panel lives exclusively inside /sala/[bookingId] (LiveKit
 * room). Driving the full LiveKit session from Playwright is impractical (see
 * the header note on `session-complete.spec.ts`), so this spec splits coverage
 * the same way that spec does:
 *
 *   1. Source-level smoke — `NotesPanel.tsx` still imports `saveSessionNotes`
 *      and still invokes it with `(sessionId, value)` inside a debounce
 *      `setTimeout`. If that wiring ever drops, teachers would type into a
 *      void with no error and every note would silently evaporate.
 *
 *   2. DB contract — the exact mutation `saveSessionNotes` performs
 *      (`update sessions set notes = ... where id = :sessionId`) actually
 *      persists when applied against the live DB. A silent column rename in
 *      a future migration would turn the real save call into a no-op at
 *      runtime — this test flips red first.
 *
 *   3. Ownership FK resolves — the authz check in `saveSessionNotes` walks
 *      `sessions.booking.teacher.profile_id`. If ANY link in that chain
 *      breaks (e.g., `teachers.profile_id` renamed), every real save call
 *      would 401 despite the caller being the right teacher. The static
 *      guard in `server-action-authz.spec.ts` only asserts the CHECK is
 *      present — this test ensures the DB shape the check relies on exists.
 *
 * The runtime authz rejection path (wrong caller → returns { success: false })
 * is covered by the static guard plus the column-level GRANTs in migration
 * 016 (`sessions` writes are blocked for non-admin roles). Re-testing that
 * here would mean standing up a second authenticated teacher session and
 * invoking the Next.js server action via a synthetic POST — high effort for
 * coverage that already has two independent guards.
 */

test.describe('Tier 2.3 — saveSessionNotes contract', () => {
  let fx: BookingFixture | null = null
  let sessionId: string | null = null
  let bookingId: string | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
    if (fx) {
      // Seed a confirmed booking scheduled recently — same shape as
      // session-complete.spec.ts's joinable booking.
      const scheduled = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      bookingId = await insertBooking(fx, { status: 'confirmed', scheduledAt: scheduled })
      if (bookingId) {
        // Manually insert the session row. In production getRoomAccess() in
        // video.ts creates it during LiveKit connect; we skip that to avoid
        // needing a real room. The row shape must satisfy the FKs used by
        // saveSessionNotes's ownership walk.
        const { data } = await fx.admin
          .from('sessions')
          .insert({
            booking_id: bookingId,
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        sessionId = data?.id ?? null
      }
    }
  })

  test.afterAll(async () => {
    try {
      if (fx && sessionId) {
        // Clean up the seeded session row — the booking cleanup in
        // fx.cleanup() handles bookings but sessions are separate.
        await fx.admin.from('sessions').delete().eq('id', sessionId)
      }
    } catch {}
    try { await fx?.cleanup() } catch {}
  })

  test('NotesPanel wires textarea onChange → saveSessionNotes via debounce', () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        'src/app/[lang]/sala/[bookingId]/components/NotesPanel.tsx',
      ),
      'utf8',
    )

    // Import contract — must come from the canonical action module so the
    // function identity matches what server-action-authz.spec.ts guards.
    expect(
      /import\s*\{[^}]*saveSessionNotes[^}]*\}\s*from\s*['"]@\/app\/actions\/video['"]/.test(src),
      'NotesPanel must import saveSessionNotes from @/app/actions/video',
    ).toBe(true)

    // Debounce contract — the call must be inside a setTimeout passing the
    // component's sessionId. If this ever shifts to a direct on-blur/save
    // button, users will lose data on abrupt disconnects (common on flaky
    // LiveKit reconnects).
    expect(
      /setTimeout\([\s\S]*?saveSessionNotes\(\s*sessionId/m.test(src),
      'NotesPanel must invoke saveSessionNotes inside a debounce setTimeout',
    ).toBe(true)
  })

  test('contract: update sessions.notes persists and survives re-read', async () => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')
    test.skip(!sessionId, 'Seeded session row unavailable (check bookings/sessions schema)')

    // Replicate saveSessionNotes's DB write. A column rename/drop in a future
    // migration would make this fail immediately.
    const payload = `E2E note payload ${Date.now()}`
    const { error } = await fx!.admin
      .from('sessions')
      .update({ notes: payload })
      .eq('id', sessionId!)
    expect(error, 'update to sessions.notes should succeed (column exists)').toBeNull()

    const { data } = await fx!.admin
      .from('sessions')
      .select('notes')
      .eq('id', sessionId!)
      .single()
    expect(data?.notes, 'notes column must echo the written payload').toBe(payload)
  })

  test('contract: ownership chain sessions→booking→teacher→profile_id resolves correctly', async () => {
    test.skip(!fx, 'Fixture unavailable')
    test.skip(!sessionId, 'Seeded session row unavailable')

    // saveSessionNotes compares `sessionRow?.booking?.teacher?.profile_id`
    // against `user.id`. Verify the exact nested select shape the action uses
    // resolves, and resolves to OUR fixture teacher's auth user id.
    const { data } = await fx!.admin
      .from('sessions')
      .select(`
        id,
        booking:bookings(teacher:teachers(profile_id))
      `)
      .eq('id', sessionId!)
      .single()

    const teacherProfileId = (data as any)?.booking?.teacher?.profile_id
    expect(
      teacherProfileId,
      'ownership chain must resolve — broken FK = every real save 401s',
    ).toBeTruthy()
    expect(
      teacherProfileId,
      'must resolve to the fixture teacher auth user id',
    ).toBe(fx!.teacher.userId)
  })
})
