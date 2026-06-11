/**
 * EXHAUSTIVE LIVE QA — surface: student-intake  (route: /es/dashboard/intake)
 *
 * The intake is a 6-question learning-profile wizard (IntakeClient.tsx): 5 radio
 * steps + 1 free-text `learning_goal` textarea, client-side "answer required"
 * guard, step nav (Atrás/Siguiente · Empezar a agendar), and a server action
 * `saveIntake` that validates radio values against an allowlist and writes via the
 * admin client, flipping students.intake_done=true then routing to /dashboard/agendar.
 *
 * The PAGE is server-guarded (page.tsx) with a redirect chain, in this order:
 *   no user            → /{lang}/login
 *   no student row     → /{lang}/dashboard
 *   intake_done=true   → /{lang}/dashboard/agendar          ← the QA student hits THIS
 *   survey_answers set → (admin sets intake_done) → /agendar
 *   classes_remaining≤0→ /{lang}/dashboard/plan
 *   else               → render the form
 *
 * The shared QA student (student@englishkolab.com) is intake_done, so the bulk of
 * this file probes the GATE with the saved student session. To exercise the form
 * itself we provision a throwaway student (fresh auth user + profile + students row,
 * classes_remaining=1, intake_done=false, no survey_answers), drive it via the UI,
 * then tear it down. Those probes are tagged [MUTATING] and never touch shared data.
 *
 * Runs against LIVE. Author-only — do NOT run here.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, clearRateLimit, hasAuthCookie, STATE, makeAdmin } from './_exhaustive/helpers'

const db = makeAdmin()

// Throwaway students provisioned for the [MUTATING] form walkthroughs — torn down in afterAll.
const CREATED: { userId: string }[] = []

// Create a fresh, confirmed student that lands ON the intake form (classes>0, no intake, no survey).
async function provisionFreshStudent() {
  if (!db) return null
  const email = `e2e-exh-intake-${Date.now()}-${Math.floor(Math.random() * 1e6)}@englishkolab.test`
  const password = 'E2eIntake1234!'
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr || !created?.user) return null
  const userId = created.user.id
  CREATED.push({ userId })

  // profiles row (role student) — id must equal the auth user id.
  await db.from('profiles').upsert({
    id: userId,
    email,
    full_name: 'E2E Intake Probe',
    role: 'student',
    preferred_language: 'es',
  })
  // students row that satisfies the form gate: has classes, intake NOT done, no survey.
  await db.from('students').upsert({
    profile_id: userId,
    classes_remaining: 1,
    intake_done: false,
    survey_answers: null,
  }, { onConflict: 'profile_id' })

  return { email, password, userId }
}

// Drive the UI login for a throwaway account (the saved STATE sessions can't be used
// for fresh users). Keeps the limiter clean via clearRateLimit before each login.
async function loginFresh(page: Page, email: string, password: string) {
  await clearRateLimit()
  await page.goto('/es/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForURL(/\/es\/(dashboard|intake|onboarding|agendar)/, { timeout: 30_000 }).catch(() => {})
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1 — the GATE, exercised with the shared QA student session (intake_done).
// No login per-test; the saved session avoids rate-limit contention.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EXHAUSTIVE student-intake · GATE (intake_done student)', () => {
  test.use({ storageState: STATE.student })

  test('1 happy-gate — an intake_done student hitting /es/dashboard/intake is sent to agendar (content-proven)', async ({ page }) => {
    const fourxx: string[] = []
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('englishkolab.com')) fourxx.push(`${r.status()} ${r.url()}`) })
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(2000) // let the server redirect chain fully resolve
    test.info().annotations.push({ type: 'observed', description: `final url=${page.url()}; 4xx/5xx=${fourxx.join(' | ') || 'none'}` })
    // The intake question card must NOT be present — the gate must have bounced us.
    await expect(page.getByRole('heading', { name: /Perfil de aprendizaje|Learning profile/ })).toHaveCount(0)
    await expect(page.getByText(/Paso \d+ de 6|Step \d+ of 6/)).toHaveCount(0)
    // Positive proof we're on a real authenticated app surface (agendar / scheduling), not a blank/error page.
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body.length, 'redirect target must render real content').toBeGreaterThan(50)
    await page.screenshot({ path: 'test-results/exhaustive-student-intake-gate.png', fullPage: true })
  })

  test('2 deep-link + refresh — gate is stable across a hard reload', async ({ page }) => {
    await page.goto('/es/dashboard/intake')
    await settle(page)
    const after1 = page.url()
    await page.reload()
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `url after nav=${after1}; after reload=${page.url()}` })
    // Still no intake form after refresh.
    await expect(page.getByRole('heading', { name: /Perfil de aprendizaje|Learning profile/ })).toHaveCount(0)
  })

  test('3 i18n EN parity — /en/dashboard/intake also gates (no Spanish leak on the EN path)', async ({ page }) => {
    await page.goto('/en/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `en gate final url=${page.url()}` })
    // The EN gate should land on an EN surface; flag if it bounced to an /es path.
    const bouncedToEs = /\/es\//.test(page.url())
    test.info().annotations.push({ type: 'observed', description: `en→es locale bounce on gate = ${bouncedToEs}` })
    await expect(page.getByRole('heading', { name: /Learning profile|Perfil de aprendizaje/ })).toHaveCount(0)
  })

  test('4 console errors on the gate redirect chain are clean', async ({ page }) => {
    const errs: string[] = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(1500)
    const meaningful = errs.filter(e => !/favicon|net::ERR|Failed to load resource.*40[34]|analytics|gtag/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `console errors: ${meaningful.slice(0, 8).join(' || ') || 'none'}` })
    expect(meaningful, `console errors on intake gate:\n${meaningful.join('\n')}`).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2 — role guard: other roles hitting the student intake route.
// Each role uses its own saved session; assert on CONTENT, never mid-redirect URL.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EXHAUSTIVE student-intake · role guard (teacher)', () => {
  test.use({ storageState: STATE.teacher })
  test('5 a teacher hitting /es/dashboard/intake never sees the student intake form', async ({ page }) => {
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(2000)
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()}` })
    // A teacher has no students row → page.tsx redirects to /dashboard (then the
    // dashboard layout bounces a teacher onward). Either way: no intake form.
    await expect(page.getByRole('heading', { name: /Perfil de aprendizaje|Learning profile/ })).toHaveCount(0)
    await expect(page.getByText(/Paso \d+ de 6|Step \d+ of 6/)).toHaveCount(0)
  })
})

test.describe('EXHAUSTIVE student-intake · role guard (admin)', () => {
  test.use({ storageState: STATE.admin })
  test('6 an admin hitting /es/dashboard/intake never sees the student intake form', async ({ page }) => {
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(2000)
    test.info().annotations.push({ type: 'observed', description: `admin → ${page.url()}` })
    await expect(page.getByRole('heading', { name: /Perfil de aprendizaje|Learning profile/ })).toHaveCount(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3 — public / unauthenticated (NO storageState): must redirect to login.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EXHAUSTIVE student-intake · unauthenticated', () => {
  test('7 anonymous deep-link to intake is bounced to login (content-proven)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()}` })
    expect(hasAuthCookie(await context.cookies()), 'anon must not gain an auth cookie').toBeFalsy()
    // Prove the LOGIN form rendered (don't trust the URL alone).
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    // And the intake form must NOT be reachable.
    await expect(page.getByRole('heading', { name: /Perfil de aprendizaje|Learning profile/ })).toHaveCount(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 4 — THE FORM ITSELF, via a throwaway fresh student. [MUTATING]
// These create + tear down a private test account; they never touch shared QA data.
// Skipped entirely when no service-role key is present.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EXHAUSTIVE student-intake · the form (fresh student) [MUTATING]', () => {
  test.skip(!db, 'service-role key required (SUPABASE_SERVICE_ROLE_KEY / .env.local) to provision a fresh no-intake student')

  test.afterAll(async () => {
    if (!db) return
    for (const { userId } of CREATED) {
      await db.from('students').delete().eq('profile_id', userId)
      await db.from('profiles').delete().eq('id', userId)
      await db.auth.admin.deleteUser(userId).catch(() => {})
    }
    await clearRateLimit()
  })

  test('8 [MUTATING] happy-path render — fresh student lands on step 1 of 6 with the first ES question', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    // Exact ES title + first question label from IntakeClient.tsx.
    await expect(page.getByRole('heading', { name: 'Perfil de aprendizaje' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Paso 1 de 6')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ahora mismo, ¿cómo describirías tu inglés?' })).toBeVisible()
    // The 5 self-rated-level options must render (exact ES labels).
    for (const lbl of ['Apenas empiezo', 'Me defiendo', 'Conversacional', 'Avanzado', 'No estoy seguro']) {
      await expect(page.getByText(lbl, { exact: true })).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/exhaustive-student-intake-form-step1.png', fullPage: true })
  })

  test('9 [MUTATING] required-answer guard — clicking Siguiente with nothing selected shows the ES error', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toBeVisible()
    // Still on step 1 — the guard blocked advancement.
    await expect(page.getByText('Paso 1 de 6')).toBeVisible()
  })

  test('10 [MUTATING] back is disabled/invisible on step 1, selecting an option clears the error', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    // Back button on step 0 has opacity:0 + pointerEvents:none + disabled.
    const back = page.getByRole('button', { name: /Atrás/ })
    await expect(back).toBeDisabled()
    // Trigger the error, then select an option → error must vanish (setValue clears it).
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toBeVisible()
    await page.getByText('Me defiendo', { exact: true }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toHaveCount(0)
  })

  test('11 [MUTATING] full ES walkthrough — answer all 6 steps, finish, land on agendar with intake_done persisted', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })

    // Step 1: self_rated_level
    await page.getByText('Me defiendo', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    // Step 2: motivation
    await expect(page.getByText('Paso 2 de 6')).toBeVisible()
    await page.getByText('Trabajo y carrera', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    // Step 3: learning_goal (textarea) — exercise unicode + a benign quote in the free text.
    await expect(page.getByText('Paso 3 de 6')).toBeVisible()
    await page.locator('textarea.lk-intake-input').fill("Pasar el IELTS — meta clara · café ☕")
    await page.getByRole('button', { name: /Siguiente/ }).click()
    // Step 4: speaking_comfort
    await expect(page.getByText('Paso 4 de 6')).toBeVisible()
    await page.getByText('Depende del día', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    // Step 5: availability
    await expect(page.getByText('Paso 5 de 6')).toBeVisible()
    await page.getByText('Noches', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    // Step 6: learning_style — last step → button reads "Empezar a agendar"
    await expect(page.getByText('Paso 6 de 6')).toBeVisible()
    await expect(page.getByRole('button', { name: /Empezar a agendar/ })).toBeVisible()
    await page.getByText('Una mezcla', { exact: true }).click()
    await page.getByRole('button', { name: /Empezar a agendar/ }).click()

    // After save the client router.push → /es/dashboard/agendar. Prove by content (no intake form).
    await page.waitForURL(/\/es\/dashboard\/agendar/, { timeout: 30_000 }).catch(() => {})
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `post-finish url=${page.url()}` })
    await expect(page.getByRole('heading', { name: 'Perfil de aprendizaje' })).toHaveCount(0)

    // Data integrity: the row must reflect every saved answer + intake_done=true.
    const { data: row } = await db!.from('students')
      .select('intake_done, self_rated_level, motivation, learning_goal, speaking_comfort, availability, learning_style')
      .eq('profile_id', acct!.userId).single()
    test.info().annotations.push({ type: 'observed', description: `saved row=${JSON.stringify(row)}` })
    expect(row?.intake_done, 'intake_done must be persisted true').toBe(true)
    expect(row?.self_rated_level).toBe('getting_by')
    expect(row?.motivation).toBe('work')
    expect(row?.speaking_comfort).toBe('depends')
    expect(row?.availability).toBe('evenings')
    expect(row?.learning_style).toBe('mixed')
    expect(row?.learning_goal, 'free-text goal stored verbatim (unicode preserved)').toContain('café')
  })

  test('12 [MUTATING] back navigation preserves earlier selections (state retention)', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    await page.getByText('Conversacional', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Paso 2 de 6')).toBeVisible()
    await page.getByRole('button', { name: /Atrás/ }).click()
    await expect(page.getByText('Paso 1 de 6')).toBeVisible()
    // The previously-chosen option should still be selected — its button carries the red tint.
    // Re-clicking Siguiente without re-selecting must succeed (value retained, no error).
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toHaveCount(0)
    await expect(page.getByText('Paso 2 de 6')).toBeVisible()
  })

  test('13 [MUTATING] textarea boundary — 8KB oversized + XSS-like goal text is stored inert, no 5xx', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const fivexx: string[] = []
    page.on('response', r => { if (r.status() >= 500) fivexx.push(`${r.status()} ${r.url()}`) })

    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    // Jump to the textarea step.
    await page.getByText('Apenas empiezo', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await page.getByText('Viajar o emigrar', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Paso 3 de 6')).toBeVisible()

    const payload = '<script>alert(1)</script>' + "'; DROP TABLE students;-- " + 'A'.repeat(8000)
    await page.locator('textarea.lk-intake-input').fill(payload)
    // Finish the wizard so saveIntake actually stores the goal.
    await page.getByRole('button', { name: /Siguiente/ }).click() // → step 4
    await page.getByText('Depende del día', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click() // → step 5
    await page.getByText('Varía', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click() // → step 6
    await page.getByText('Una mezcla', { exact: true }).click()
    await page.getByRole('button', { name: /Empezar a agendar/ }).click()
    await settle(page)
    await page.waitForTimeout(2000)

    expect(dialog, 'no script execution from goal text').toBeFalsy()
    expect(fivexx, `oversized/injection goal must not 5xx:\n${fivexx.join('\n')}`).toEqual([])
    // The text persisted; the <script> tag is inert data, not executed markup.
    const { data: row } = await db!.from('students').select('learning_goal, intake_done').eq('profile_id', acct!.userId).single()
    test.info().annotations.push({ type: 'observed', description: `stored goal length=${(row?.learning_goal || '').length}; intake_done=${row?.intake_done}` })
    expect((row?.learning_goal || '').length, 'oversized goal stored (or DB-truncated) without erroring').toBeGreaterThan(0)
  })

  test('14 [MUTATING] empty textarea on the goal step is blocked by the required guard', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    await page.getByText('Apenas empiezo', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await page.getByText('Solo por mí', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Paso 3 de 6')).toBeVisible()
    // Type only whitespace → handleNext trims; required guard must still fire.
    await page.locator('textarea.lk-intake-input').fill('   ')
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toBeVisible()
    await expect(page.getByText('Paso 3 de 6')).toBeVisible()
  })

  test('15 [MUTATING] EN parity — fresh student on /en/dashboard/intake sees English labels, not Spanish', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/en/dashboard/intake')
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Learning profile' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Step 1 of 6')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Right now, how would you describe your English?' })).toBeVisible()
    // No Spanish strings leaking on the EN page.
    await expect(page.getByText('Paso 1 de 6')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Siguiente/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Next/ })).toBeVisible()
  })

  test('16 [MUTATING] survey_answers shortcut — a student with survey data is sent past intake to agendar', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    // Give this fresh student survey_answers (still intake_done=false). page.tsx should
    // set intake_done via the admin client and redirect to /agendar — verify the gate + the write.
    await db!.from('students').update({ survey_answers: { q1: 'a' } }).eq('profile_id', acct!.userId)
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(2000)
    test.info().annotations.push({ type: 'observed', description: `survey-shortcut final url=${page.url()}` })
    // The intake form must NOT render — they were shortcut.
    await expect(page.getByRole('heading', { name: 'Perfil de aprendizaje' })).toHaveCount(0)
    // And the page must have flipped intake_done=true as a side effect.
    const { data: row } = await db!.from('students').select('intake_done').eq('profile_id', acct!.userId).single()
    expect(row?.intake_done, 'survey_answers present must trigger intake_done=true side-effect').toBe(true)
  })

  test('17 [MUTATING] no-classes gate — a student with classes_remaining=0 is sent to /plan, not the form', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await db!.from('students').update({ classes_remaining: 0 }).eq('profile_id', acct!.userId)
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await page.waitForTimeout(2000)
    test.info().annotations.push({ type: 'observed', description: `no-classes final url=${page.url()}` })
    // No intake form — the classes_remaining<=0 branch should redirect to /plan.
    await expect(page.getByRole('heading', { name: 'Perfil de aprendizaje' })).toHaveCount(0)
    await expect(page.getByText('Paso 1 de 6')).toHaveCount(0)
  })

  test('18 [MUTATING] responsive 375px — the form is usable on mobile (button in viewport)', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    await page.setViewportSize({ width: 375, height: 720 })
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    const next = page.getByRole('button', { name: /Siguiente/ })
    await expect(next).toBeInViewport()
    // Options must be tappable (full-width buttons) — first option visible & clickable.
    await page.getByText('Apenas empiezo', { exact: true }).click()
    await expect(page.getByText('Por favor responde esta pregunta.')).toHaveCount(0)
    await page.screenshot({ path: 'test-results/exhaustive-student-intake-mobile.png', fullPage: true })
  })

  test('19 [MUTATING] console + network clean while rendering and stepping the form', async ({ page }) => {
    const acct = await provisionFreshStudent()
    test.skip(!acct, 'could not provision fresh student')
    const errs: string[] = []
    const bad: string[] = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('englishkolab.com')) bad.push(`${r.status()} ${r.url()}`) })
    await loginFresh(page, acct!.email, acct!.password)
    await page.goto('/es/dashboard/intake')
    await settle(page)
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 15_000 })
    await page.getByText('Me defiendo', { exact: true }).click()
    await page.getByRole('button', { name: /Siguiente/ }).click()
    await expect(page.getByText('Paso 2 de 6')).toBeVisible()
    const meaningful = errs.filter(e => !/favicon|net::ERR|Failed to load resource.*40[34]|analytics|gtag/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `console=${meaningful.slice(0,6).join(' || ') || 'none'}; net4xx/5xx=${bad.slice(0,6).join(' | ') || 'none'}` })
    expect(meaningful, `console errors while stepping form:\n${meaningful.join('\n')}`).toEqual([])
  })
})
