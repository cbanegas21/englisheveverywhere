/**
 * Post-deploy verification of cluster #1 fixes against LIVE (englishkolab.com).
 * Run AFTER deploy with fresh sessions:
 *   node scripts/qa-save-states.mjs && npx playwright test verify-fixes.spec.ts --workers=1
 */
import { test, expect } from '@playwright/test'
import { STATE, makeAdmin, settle } from './_exhaustive/helpers'

const db = makeAdmin()
const FEEDBACK = 'QA-VERIFY-FEEDBACK-7731'
let assignmentId: string | null = null

test.describe('VERIFY cluster #1 fixes on LIVE', () => {
  test.skip(!db, 'service role required')

  // LIVE-S01 — garbage ?weekStart used to crash with a 500.
  test('S01 — admin /bookings?weekStart=garbage renders (no 500)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    const resp = await page.goto('/es/admin/bookings?weekStart=garbage')
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `HTTP ${resp?.status()}` })
    expect(resp?.status() ?? 0, 'must not be 5xx').toBeLessThan(500)
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body, 'no error boundary').not.toMatch(/application error|client-side exception|something went wrong/)
    await ctx.close()
  })

  // LIVE-S03 — seeded times (09:00:00) used to reset the <select> to 00:00 on load.
  test('S03 — teacher availability shows real times, not 00:00', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/maestro/dashboard/disponibilidad')
    await settle(page)
    const firstSelect = page.locator('select').first()
    await expect(firstSelect).toBeVisible({ timeout: 15_000 })
    const val = await firstSelect.inputValue()
    test.info().annotations.push({ type: 'observed', description: `first time select = ${val}` })
    expect(val, 'seeded 09:00 slot must render, not reset to 00:00').not.toBe('00:00')
    await ctx.close()
  })

  // LIVE-S11 [HIGH] — submissions never rendered (mis-indexed embed). Seed a GRADED
  // submission; with the fix the read-only graded view shows the teacher's feedback.
  test('S11 — a graded assignment renders its feedback (submission is read)', async ({ browser }) => {
    const { data: sp } = await db!.from('profiles').select('id').eq('email', 'student@englishkolab.com').single()
    const { data: tp } = await db!.from('profiles').select('id').eq('email', 'teacher@englishkolab.com').single()
    const { data: srow } = await db!.from('students').select('id').eq('profile_id', sp!.id).single()
    const { data: trow } = await db!.from('teachers').select('id').eq('profile_id', tp!.id).single()
    const { data: a } = await db!.from('assignments').insert({
      teacher_id: trow!.id, student_id: srow!.id,
      title: 'QA-VERIFY assignment', instructions: 'Verify the submission renders.', status: 'open',
    }).select('id').single()
    assignmentId = a!.id
    await db!.from('assignment_submissions').insert({
      assignment_id: assignmentId,
      submitted_text: 'QA verify submitted text',
      teacher_feedback: FEEDBACK,
      score: 'excellent',
      graded_at: new Date().toISOString(),
    })

    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/tareas')
    await settle(page)
    await page.getByText('QA-VERIFY assignment').first().click().catch(() => {})
    await settle(page, 1500)
    const body = await page.locator('body').innerText()
    expect(body, 'graded feedback must render (proves the embed fix works)').toContain(FEEDBACK)
    await ctx.close()
  })

  test.afterAll(async () => {
    if (!db || !assignmentId) return
    await db.from('assignment_submissions').delete().eq('assignment_id', assignmentId)
    await db.from('assignments').delete().eq('id', assignmentId)
  })
})
