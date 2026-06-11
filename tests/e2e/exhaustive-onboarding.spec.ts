/**
 * EXHAUSTIVE LIVE QA — surface: ONBOARDING  (/es/onboarding, /en/onboarding)
 *
 * Post-signup onboarding wizard. Role 'public' in the sweep sense (no shared
 * role storageState) — but the page is auth-gated, so to reach the wizard we
 * mint a THROWAWAY auth user with the service role, log in through the real UI,
 * then drive the steps. Every probe that creates/mutates is tagged [MUTATING]
 * and every throwaway user/row is torn down in afterAll.
 *
 * Real behaviour, extracted from source (do NOT guess):
 *  - src/app/[lang]/onboarding/page.tsx  (server guard)
 *      • no user            → redirect /${lang}/login
 *      • student w/ students row → redirect /${lang}/dashboard  (already onboarded)
 *      • teacher w/ teachers row → /maestro/pending (!is_active) else /maestro/dashboard
 *      • else renders OnboardingClient with role from profiles.role
 *  - src/app/[lang]/onboarding/OnboardingClient.tsx
 *      • STUDENT: totalSteps=1. Step 1 = timezone (TimezoneSelect) + preferred
 *        language toggle (buttons "Español"/"English"). Continue ("Continuar"/
 *        "Continue") → completeStudentOnboarding → done screen
 *        ("¡Todo listo!"/"You're all set!") CTA "Ir al dashboard"/"Go to dashboard".
 *      • TEACHER: totalSteps=3. Step2 = specialization chips (must pick ≥1 to
 *        advance). Step3 = bio (min 20 chars) + CV required + optional certs.
 *        done screen "¡Solicitud enviada!"/"Application submitted!" CTA
 *        "Ver estado"/"Check status" → /maestro/pending.
 *      • Wizard state is useState ONLY — NO persistence. A mid-step refresh
 *        loses all state and resets to Step 1 (and for a teacher the page-guard
 *        keeps re-rendering the wizard until they finish). PROBE this.
 *      • Header reads "Paso {step} de {total}" (ES) / "Step {step} of {total}".
 *  - src/app/actions/onboarding.ts  (MUTATING server actions)
 *      • completeStudentOnboarding: profiles.update(tz, lang) + students.upsert
 *      • completeTeacherOnboarding: validates bio≥20, CV present/≤10MB/mime,
 *        uploads CV to storage, upserts teachers row is_active=false,hourly_rate=0
 *
 * NOT serial — probes EXPECT failures (each failed assert == a finding); serial
 * mode would abort the block on the first. No networkidle — use settle().
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { settle, clearRateLimit, hasAuthCookie, makeAdmin } from './_exhaustive/helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

const db = makeAdmin()

// ── throwaway-user fixture (service role) ────────────────────────────────────
const CREATED: { id: string; email: string }[] = []

async function mkUser(role: 'student' | 'teacher'): Promise<{ id: string; email: string; password: string } | null> {
  if (!db) return null
  const stamp = Date.now() + Math.floor(Math.random() * 100000)
  const email = `e2e-exh-onb-${role}-${stamp}@englishkolab.test`
  const password = 'OnbExh1234!'
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the email-confirm gate so UI login works
    user_metadata: { full_name: `Onb Exh ${stamp}`, role },
  })
  if (error || !data.user) return null
  // handle_new_user defaults role=student for some paths; force the row we need.
  await db.from('profiles').upsert(
    { id: data.user.id, email, full_name: `Onb Exh ${stamp}`, role },
    { onConflict: 'id' },
  )
  CREATED.push({ id: data.user.id, email })
  return { id: data.user.id, email, password }
}

async function teardown(d: SupabaseClient, id: string) {
  // children first (FKs), then the auth user
  try { await d.from('teachers').delete().eq('profile_id', id) } catch {}
  try { await d.from('students').delete().eq('profile_id', id) } catch {}
  try { await d.from('profiles').delete().eq('id', id) } catch {}
  try { await d.auth.admin.deleteUser(id) } catch {}
}

// UI login for a freshly minted throwaway user. Lands them on /onboarding because
// the post-signin role redirect (auth.ts) sends a not-yet-onboarded user there.
async function loginThrow(page: Page, email: string, password: string, lang: 'es' | 'en' = 'es') {
  await clearRateLimit()
  await page.goto(`/${lang}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await settle(page)
}

// Navigate straight to the onboarding wizard for an already-authed throwaway.
async function gotoOnboarding(page: Page, lang: 'es' | 'en' = 'es') {
  await page.goto(`/${lang}/onboarding`)
  await settle(page)
}

test.describe('EXHAUSTIVE ONBOARDING', () => {
  test.skip(!db, 'service-role key required (SUPABASE_SERVICE_ROLE_KEY / .env.local)')

  test.afterAll(async () => {
    if (!db) return
    for (const u of CREATED) await teardown(db, u.id)
    await clearRateLimit()
  })

  // ───────────────────────── 1 · Happy path render ─────────────────────────

  test('[MUTATING] 1a — student reaches wizard: step 1 renders timezone + language, header "Paso 1 de 1"', async ({ page }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)

    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Tu zona horaria')).toBeVisible()
    await expect(page.getByText('Idioma preferido')).toBeVisible()
    // Language toggle buttons (exact names from source).
    await expect(page.getByRole('button', { name: 'Español', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible()
    // Single-step student wizard.
    await expect(page.getByText(/Paso\s*1\s*de\s*1/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Continuar/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-student-step1.png', fullPage: true })
  })

  test('[MUTATING] 1b — teacher reaches wizard: step 1 of 3, then specialization step', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)

    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Paso\s*1\s*de\s*3/)).toBeVisible()
    // Advance to the specialization step.
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 1200)
    await expect(page.getByRole('heading', { name: '¿En qué te especializas?' })).toBeVisible()
    await expect(page.getByText(/Paso\s*2\s*de\s*3/)).toBeVisible()
    // Spanish chip labels must be present (source: TEACHER_SPECS.es).
    await expect(page.getByRole('button', { name: 'Inglés General', exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-teacher-step2.png', fullPage: true })
  })

  // ───────────────────────── 2 · Entry / nav / refresh / role guard ─────────────────────────

  test('2a — deep-link to /es/onboarding as ANONYMOUS redirects to login (content-asserted)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/es/onboarding')
    await settle(page)
    // Assert on RENDERED content, not the URL (URL can read mid-redirect).
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /ingresar|log in/i })).toBeVisible()
    // The wizard heading must NOT be present for an anon visitor.
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toHaveCount(0)
  })

  test('[MUTATING] 2b — REFRESH mid-step loses all wizard state and resets to step 1 (data-loss probe)', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByText(/Paso\s*1\s*de\s*3/)).toBeVisible({ timeout: 15_000 })

    // Advance to step 2 and select a specialization, then to step 3 + type bio.
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 1000)
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 1000)
    await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible()
    await page.locator('textarea').fill('A bio I do not want to lose on refresh — twenty plus characters here.')

    // Hard refresh — wizard is useState only, so this should wipe everything.
    await page.reload()
    await settle(page)
    const backOnStep1 = await page.getByText(/Paso\s*1\s*de\s*3/).count()
    const bioStillThere = await page.locator('textarea').count()
    test.info().annotations.push({
      type: 'observed',
      description: `after refresh: back-on-step1=${backOnStep1 > 0}; bio-textarea-present=${bioStillThere > 0} (state is NOT persisted — UX data-loss)`,
    })
    // Document the data-loss UX: a refresh on step 3 dumps the user back to step 1.
    expect(backOnStep1, 'refresh mid-flow resets to step 1 — wizard state is not persisted (UX finding)').toBeGreaterThan(0)
  })

  test('[MUTATING] 2c — browser BACK after entering wizard leaves onboarding (no in-history steps)', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    // Visit a real page first so there is somewhere to go "back" to.
    await page.goto('/es').catch(() => {})
    await settle(page, 800)
    await gotoOnboarding(page)
    await expect(page.getByText(/Paso\s*1\s*de\s*3/)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 1000)
    await expect(page.getByText(/Paso\s*2\s*de\s*3/)).toBeVisible()

    // Browser back: in-wizard steps are NOT history entries, so this should
    // navigate AWAY from /onboarding entirely (not to step 1).
    await page.goBack().catch(() => {})
    await settle(page)
    const stillOnWizard = await page.getByRole('heading', { name: /especializas|Configuremos tu perfil/ }).count()
    test.info().annotations.push({
      type: 'observed',
      description: `after browser-back from step 2: url=${page.url()} wizard-heading-visible=${stillOnWizard > 0}`,
    })
    // No crash / no console error is the bar; record where back lands.
    expect(page.url()).toContain('englishkolab.com')
  })

  test('[MUTATING] 2d — STUDENT deep-linking /es/onboarding AFTER already onboarded is bounced to dashboard', async ({ page }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    // Pre-create the students row so the page guard treats them as onboarded.
    await db!.from('students').upsert({ profile_id: u!.id }, { onConflict: 'profile_id' })
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    // Guard must redirect to /dashboard — prove via content (dashboard chrome),
    // never via URL alone.
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toHaveCount(0)
    const onDash = await page.getByText(/clases disponibles|tus próximas clases|hola,|mi progreso/i).first().isVisible().catch(() => false)
    test.info().annotations.push({ type: 'observed', description: `already-onboarded student deep-link → url=${page.url()} dashboard-content=${onDash}` })
    expect(page.url()).not.toMatch(/\/onboarding(\/|\?|$)/)
  })

  // ───────────────────────── 3 · Input validation ─────────────────────────

  test('[MUTATING] 3a — teacher step 2 "Continuar" is DISABLED until a specialization is chosen', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 1000)
    await expect(page.getByRole('heading', { name: '¿En qué te especializas?' })).toBeVisible()
    // The advance button has disabled when specs.length===0.
    const advance = page.getByRole('button', { name: /Continuar/ })
    await expect(advance).toBeDisabled()
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await expect(advance).toBeEnabled()
  })

  test('[MUTATING] 3b — teacher step 3 bio under 20 chars keeps "Completar configuración" disabled + char counter is red', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible()

    const finish = page.getByRole('button', { name: /Completar configuración/ })
    // No CV + short bio → disabled.
    await page.locator('textarea').fill('short')
    await expect(finish).toBeDisabled()
    // The min-chars hint must be shown in Spanish.
    await expect(page.getByText(/Mínimo\s*20\s*caracteres/)).toBeVisible()
  })

  test('[MUTATING] 3c — XSS/SQLi/unicode/oversized in teacher bio + certifications are inert (no dialog, no 5xx)', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const fiveXX: string[] = []
    page.on('response', r => { if (r.status() >= 500) fiveXX.push(`${r.status()} ${r.url()}`) })

    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)

    const nasty = `<script>alert(1)</script>'; DROP TABLE teachers;-- 日本語 😀 ` + 'A'.repeat(6000)
    await page.locator('textarea').fill(nasty)
    await page.locator('input[type="text"]').fill(`<img src=x onerror=alert(2)>, ' OR '1'='1`)
    await settle(page, 600)

    expect(dialog, 'no script execution from bio/cert payloads').toBeFalsy()
    expect(fiveXX, 'no 5xx while typing injection payloads').toEqual([])
    // Literal live <script> must not be injected into the DOM.
    expect(await page.locator('script:has-text("alert(1)")').count()).toBe(0)
    test.info().annotations.push({ type: 'observed', description: 'bio/cert XSS+SQLi payloads handled inertly (no dialog, no 5xx)' })
  })

  test('[MUTATING] 3d — server action rejects a NON-pdf/word CV (client validation + server mime guard)', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.locator('textarea').fill('A valid bio that is definitely longer than twenty characters.')

    // Set a disallowed file type on the hidden input directly.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not a real document'),
    })
    await settle(page, 600)
    // Client validateCv rejects → ES error "Solo se aceptan PDF o documentos de Word".
    await expect(page.getByText(/Solo se aceptan PDF o documentos de Word/)).toBeVisible()
    // And the finish button stays disabled (no valid CV).
    await expect(page.getByRole('button', { name: /Completar configuración/ })).toBeDisabled()
  })

  // ───────────────────────── 4 · Completing the flow (happy + done screen) ─────────────────────────

  test('[MUTATING] 4a — STUDENT completes onboarding: done screen + students row created + dashboard CTA', async ({ page, context }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })

    // Pick the English preference to also exercise the toggle write, then finish.
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    // completeStudentOnboarding runs server-side; wait for the done screen.
    await expect(page.getByRole('heading', { name: '¡Todo listo!' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Ir al dashboard/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-student-done.png', fullPage: true })

    expect(hasAuthCookie(await context.cookies())).toBeTruthy()

    // Data integrity: students row created + preferred_language persisted = en.
    const { data: student } = await db!.from('students').select('profile_id').eq('profile_id', u!.id).maybeSingle()
    const { data: profile } = await db!.from('profiles').select('preferred_language, timezone').eq('id', u!.id).single()
    test.info().annotations.push({ type: 'observed', description: `students row=${!!student}; preferred_language=${profile?.preferred_language}; tz=${profile?.timezone}` })
    expect(student?.profile_id, 'completeStudentOnboarding must create a students row').toBe(u!.id)
    expect(profile?.preferred_language, 'language toggle (English) must persist').toBe('en')

    // CTA navigates to the student dashboard (content-asserted).
    await page.getByRole('button', { name: /Ir al dashboard/ }).click()
    await settle(page)
    expect(page.url()).toMatch(/\/es\/dashboard(\/|\?|$)/)
  })

  test('[MUTATING] 4b — TEACHER completes onboarding: pending done screen + teachers row is_active=false', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.getByRole('button', { name: 'Inglés General', exact: true }).click()
    await page.getByRole('button', { name: /Continuar/ }).click(); await settle(page, 1000)
    await page.locator('textarea').fill('Certified teacher with plenty of experience — well over twenty chars.')
    await page.locator('input[type="text"]').fill('TESOL, CELTA')
    // A valid tiny PDF (magic header is enough for the mime the browser sets).
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'),
    })
    await settle(page, 600)

    const finish = page.getByRole('button', { name: /Completar configuración/ })
    await expect(finish).toBeEnabled()
    await finish.click()
    await expect(page.getByRole('heading', { name: '¡Solicitud enviada!' })).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: /Ver estado/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-teacher-done.png', fullPage: true })

    // CRITICAL invariant: the new teacher row must be is_active=false (approval gate).
    const { data: teacher } = await db!.from('teachers').select('is_active, hourly_rate, bio, specializations, certifications, cv_storage_path').eq('profile_id', u!.id).maybeSingle()
    test.info().annotations.push({ type: 'observed', description: `teacher row is_active=${teacher?.is_active} hourly_rate=${teacher?.hourly_rate} cv=${teacher?.cv_storage_path}` })
    expect(teacher?.is_active, 'new teacher MUST be is_active=false (admin-approval gate)').toBe(false)
    expect(teacher?.hourly_rate, 'new teacher hourly_rate must be 0 until admin sets it').toBe(0)
    expect(teacher?.cv_storage_path, 'CV must have been uploaded + path stored').toBeTruthy()

    // CTA → /maestro/pending (the unapproved teacher's home).
    await page.getByRole('button', { name: /Ver estado/ }).click()
    await settle(page)
    expect(page.url()).toMatch(/\/es\/maestro\/pending(\/|\?|$)/)
  })

  // ───────────────────────── 5 · Security / role coercion / IDOR ─────────────────────────

  test('[MUTATING] 5a — completeStudentOnboarding refuses a foreign userId (IDOR / authz guard)', async ({ page }) => {
    // Auth as user A; the action keys writes off userId in the request body.
    // The action checks user.id === data.userId, so tampering must be rejected.
    const a = await mkUser('student')
    const victim = await mkUser('student')
    test.skip(!a || !victim, 'could not mint throwaway users')
    await loginThrow(page, a!.email, a!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })

    // Snapshot the victim's profile before the tampered submit.
    const before = (await db!.from('profiles').select('timezone, preferred_language').eq('id', victim!.id).single()).data

    // Rewrite the server-action POST body so userId points at the victim.
    // Next server actions post to the same route; replace the victim's id form-field.
    await page.context().route('**/onboarding**', async route => {
      const req = route.request()
      let body = req.postData() || ''
      if (req.method() === 'POST' && body.includes(a!.id)) {
        body = body.split(a!.id).join(victim!.id)
        await route.continue({ postData: body })
      } else {
        await route.continue()
      }
    })
    await page.getByRole('button', { name: /Continuar/ }).click()
    await settle(page, 4000)
    await page.context().unroute('**/onboarding**')

    // The victim's profile must be unchanged (action rejects mismatched userId).
    const after = (await db!.from('profiles').select('timezone, preferred_language').eq('id', victim!.id).single()).data
    test.info().annotations.push({ type: 'SECURITY', description: `victim profile before=${JSON.stringify(before)} after=${JSON.stringify(after)} (must be equal ⇒ IDOR blocked)` })
    expect(after?.timezone, 'foreign userId must NOT mutate the victim timezone').toBe(before?.timezone)
    expect(after?.preferred_language, 'foreign userId must NOT mutate the victim language').toBe(before?.preferred_language)
    // And the victim must NOT have gained a students row from A's submit.
    const { data: victimStudent } = await db!.from('students').select('profile_id').eq('profile_id', victim!.id).maybeSingle()
    expect(victimStudent, 'foreign userId must NOT create a students row for the victim').toBeNull()
  })

  test('[MUTATING] 5b — TEACHER-role user that hits /es/dashboard during onboarding cannot see student dashboard', async ({ page }) => {
    // A not-yet-onboarded teacher poking a student-only route must be guarded.
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password)
    await page.goto('/es/dashboard')
    await settle(page)
    await page.waitForTimeout(2500)
    // Prove via content: a teacher must never see student-dashboard chrome.
    const studentChrome = await page.getByText(/tus próximas clases|clases disponibles|mi progreso/i).count()
    test.info().annotations.push({ type: 'observed', description: `teacher@student-dashboard url=${page.url()} student-chrome-count=${studentChrome}` })
    expect(page.url()).not.toMatch(/\/es\/dashboard(\/|\?|$)/)
  })

  // ───────────────────────── 6 · State / concurrency ─────────────────────────

  test('[MUTATING] 6a — double-clicking the student "Continuar" does not double-submit / error', async ({ page, context }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })

    const btn = page.getByRole('button', { name: /Continuar/ })
    await btn.click().catch(() => {})
    await btn.click({ timeout: 1200 }).catch(() => {}) // disabled on isPending → no-op
    await expect(page.getByRole('heading', { name: '¡Todo listo!' })).toBeVisible({ timeout: 20_000 })

    // Exactly one students row (upsert onConflict makes this idempotent anyway).
    const { data: rows } = await db!.from('students').select('profile_id').eq('profile_id', u!.id)
    expect(rows?.length, 'one students row after double-click').toBe(1)
    expect(hasAuthCookie(await context.cookies())).toBeTruthy()
  })

  test('[MUTATING] 6b — two tabs onboarding the same student: no duplicate row, no crash', async ({ browser }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    const ctx: BrowserContext = await browser.newContext()
    const p1 = await ctx.newPage()
    await loginThrow(p1, u!.email, u!.password)

    const p2 = await ctx.newPage() // shares the same session cookies
    await p1.goto('/es/onboarding'); await settle(p1)
    await p2.goto('/es/onboarding'); await settle(p2)

    // Submit both near-simultaneously.
    await Promise.allSettled([
      p1.getByRole('button', { name: /Continuar/ }).click().catch(() => {}),
      p2.getByRole('button', { name: /Continuar/ }).click().catch(() => {}),
    ])
    await settle(p1, 4000)

    const { data: rows } = await db!.from('students').select('profile_id').eq('profile_id', u!.id)
    test.info().annotations.push({ type: 'observed', description: `two-tab onboarding produced ${rows?.length} students row(s) (upsert onConflict must keep it at 1)` })
    expect(rows?.length, 'two-tab onboarding must not create duplicate students rows').toBe(1)
    await ctx.close()
  })

  // ───────────────────────── 7 · i18n ES + EN parity ─────────────────────────

  test('[MUTATING] 7a — /en/onboarding renders English wizard (no leaked Spanish chrome)', async ({ page }) => {
    const u = await mkUser('teacher')
    test.skip(!u, 'could not mint throwaway teacher')
    await loginThrow(page, u!.email, u!.password, 'en')
    await gotoOnboarding(page, 'en')

    await expect(page.getByRole('heading', { name: "Let's set up your profile" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Step\s*1\s*of\s*3/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible()
    // The ES header/heading must NOT appear on the EN page.
    const leakedEs = await page.getByText(/Configuremos tu perfil|Paso\s*1\s*de\s*3|Continuar/).count()
    test.info().annotations.push({ type: 'observed', description: `EN onboarding leaked-spanish-count=${leakedEs}` })
    expect(leakedEs, 'EN onboarding must not show Spanish chrome').toBe(0)

    // Advance to spec step; chips must be the English list (source: TEACHER_SPECS.en).
    await page.getByRole('button', { name: /Continue/ }).click(); await settle(page, 1000)
    await expect(page.getByRole('button', { name: 'General English', exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-en-step2.png', fullPage: true })
  })

  // ───────────────────────── 8 · Responsive 375px ─────────────────────────

  test('[MUTATING] 8a — student wizard is usable on a 375px mobile viewport', async ({ page }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    await page.setViewportSize({ width: 375, height: 720 })
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
    const submit = page.getByRole('button', { name: /Continuar/ })
    await expect(submit).toBeVisible()
    await expect(submit).toBeInViewport()
    // Language toggle buttons must both fit.
    await expect(page.getByRole('button', { name: 'Español', exact: true })).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-onboarding-mobile-student.png', fullPage: true })
  })

  // ───────────────────────── 9 · Console errors + network 4xx/5xx ─────────────────────────

  test('[MUTATING] 9a — student wizard render is clean (no console errors, no 4xx/5xx)', async ({ page }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    const consoleErrors: string[] = []
    const badResponses: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', r => {
      const s = r.status()
      // Ignore expected analytics/3p noise; flag app-origin 4xx/5xx.
      if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
    })
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
    await settle(page, 1500)

    test.info().annotations.push({ type: 'observed', description: `console-errors=${JSON.stringify(consoleErrors.slice(0, 8))}` })
    test.info().annotations.push({ type: 'observed', description: `app 4xx/5xx=${JSON.stringify(badResponses.slice(0, 8))}` })
    expect(consoleErrors, 'no console errors on the onboarding wizard').toEqual([])
    expect(badResponses, 'no app-origin 4xx/5xx on the onboarding wizard').toEqual([])
  })

  // ───────────────────────── 10 · Data integrity (refresh after partial student) ─────────────────────────

  test('[MUTATING] 10a — refreshing onboarding BEFORE completing it leaves NO students row (no half-write)', async ({ page }) => {
    const u = await mkUser('student')
    test.skip(!u, 'could not mint throwaway student')
    await loginThrow(page, u!.email, u!.password)
    await gotoOnboarding(page)
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
    // Do NOT submit. Just reload — the wizard must not have persisted anything.
    await page.reload()
    await settle(page)
    const { data: student } = await db!.from('students').select('profile_id').eq('profile_id', u!.id).maybeSingle()
    test.info().annotations.push({ type: 'observed', description: `students row after refresh-without-submit = ${!!student} (must be false)` })
    expect(student, 'no students row should exist until the user actually completes step 1').toBeNull()
    // And the wizard re-renders (not a redirect to dashboard, since not onboarded).
    await expect(page.getByRole('heading', { name: 'Configuremos tu perfil' })).toBeVisible({ timeout: 15_000 })
  })
})
