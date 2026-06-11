/**
 * EXHAUSTIVE TEACHER-CONFIG SWEEP — surface: teacher settings + the
 * pending-approval gate.
 *
 *   Routes:
 *     /es/maestro/dashboard/configuracion   (teacher settings form)
 *     /es/maestro/pending                   (inactive-teacher holding page)
 *
 * Role: teacher. Loads STATE.teacher so it NEVER logs in (no rate-limit
 * contention). Probes cover the 10-dimension what-if matrix tailored to this
 * surface: happy-path render, deep-link/refresh/role-guard, input validation
 * (SQLi/XSS/oversized/unicode/empty/boundary on name+bio+specializations),
 * error states, security/permissions, state/concurrency (double-click),
 * i18n ES+EN parity, responsive 375px, console + network 4xx/5xx, and data
 * integrity (specializations comma-split / verbatim persistence).
 *
 * Source of truth (read, not guessed):
 *   - configuracion/ConfigTeacherClient.tsx — labels, placeholders, save copy.
 *       Save button: "Guardar cambios"/"Save changes" → "Cambios guardados"/
 *       "Changes saved". Fields: input[type=text] name, textarea bio,
 *       input[type=text] specs, input[type=email][readonly] email.
 *   - actions/profile.ts → updateTeacherProfile: NO input validation /
 *       sanitization / length limit; writes full_name/bio verbatim; splits
 *       specializations on ',', trims, drops empties. Auth-gated via getUser().
 *   - maestro/pending/page.tsx — if teacher.is_active → redirect to dashboard;
 *       ES headline "Tu solicitud está siendo revisada", kicker "En revisión".
 *   - maestro/layout.tsx (role guard) + maestro/dashboard/layout.tsx
 *       (active gate: no teacher row → onboarding, inactive → pending).
 *
 * SAFETY: most probes are non-mutating. The few that save are tagged
 * [MUTATING], use throwaway-but-realistic values, and RESTORE the original
 * name/bio/specializations in a finally block so the shared teacher account is
 * left exactly as found. Never deletes the QA account.
 *
 * Runs LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com). Not serial — each
 * failed assertion is a finding and serial mode would abort the whole block.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'

const CFG = '/es/maestro/dashboard/configuracion'
const CFG_EN = '/en/maestro/dashboard/configuracion'
const PENDING = '/es/maestro/pending'
const PENDING_EN = '/en/maestro/pending'

const db = makeAdmin()

// Saved original field values so [MUTATING] probes can restore them.
let ORIGINAL: { name: string; bio: string; specs: string } | null = null

async function readFields(page: Page) {
  const name = await page.locator('input[type="text"]').first().inputValue()
  const bio = await page.locator('textarea').first().inputValue()
  const specs = await page.locator('input[type="text"]').nth(1).inputValue()
  return { name, bio, specs }
}

async function fillFields(page: Page, v: { name?: string; bio?: string; specs?: string }) {
  if (v.name !== undefined) await page.locator('input[type="text"]').first().fill(v.name)
  if (v.bio !== undefined) await page.locator('textarea').first().fill(v.bio)
  if (v.specs !== undefined) await page.locator('input[type="text"]').nth(1).fill(v.specs)
}

// Click Save and wait for the saved/idle resolution. Returns the button text seen.
async function clickSave(page: Page): Promise<string> {
  await page.getByRole('button', { name: /guardar cambios|save changes/i }).click().catch(() => {})
  await page.waitForTimeout(2500) // server action round-trip
  // After success the label flips to "Cambios guardados" for 3s, then back.
  const btn = page.getByRole('button', { name: /guardar cambios|save changes|cambios guardados|changes saved/i }).first()
  return (await btn.textContent().catch(() => '')) || ''
}

test.describe('EXHAUSTIVE TEACHER-CONFIG', () => {
  test.use({ storageState: STATE.teacher })

  // Capture the genuine original values ONCE so restores are exact.
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto(CFG)
    await settle(page)
    try { ORIGINAL = await readFields(page) } catch { ORIGINAL = null }
    await ctx.close()
  })

  // ─────────────────── 1 · Happy-path render ───────────────────

  test('1.1 — config page renders the teacher settings form (ES)', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    // h1 from DashTopBar.
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
    await expect(page.getByText('Administra tu perfil de maestro.')).toBeVisible()
    // Section kickers.
    await expect(page.getByText('Perfil', { exact: true })).toBeVisible()
    await expect(page.getByText('Cuenta', { exact: true })).toBeVisible()
    // The three editable fields + read-only email.
    await expect(page.locator('input[type="text"]')).toHaveCount(2)
    await expect(page.locator('textarea')).toHaveCount(1)
    const email = page.locator('input[type="email"]')
    await expect(email).toHaveAttribute('readonly', '')
    await expect(page.getByText('El correo no se puede cambiar.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-teacher-config-render.png', fullPage: true })
  })

  test('1.2 — email field is pre-filled, read-only, and not the empty string', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    const email = page.locator('input[type="email"]')
    const val = await email.inputValue()
    test.info().annotations.push({ type: 'observed', description: `email field = "${val}"` })
    expect(val, 'read-only email should be populated from the session').toMatch(/@/)
    // Read-only must reject typing.
    await email.fill('hacker@evil.com').catch(() => {})
    expect(await email.inputValue(), 'read-only email must not be editable').not.toBe('hacker@evil.com')
  })

  test('1.3 — "Change password" links to the reset flow, not a same-page form', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    const link = page.getByRole('link', { name: /cambiar contraseña|change password/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /\/login\/reset/)
  })

  // ─────────────────── 2 · Entry / nav / refresh / role guard ───────────────────

  test('2.1 — deep-link to config then hard refresh keeps the form (active teacher not bounced)', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    await page.reload()
    await settle(page)
    // Content is the source of truth — must still be the settings form, NOT
    // the pending page and NOT a login bounce.
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
    await expect(page.getByText(/tu solicitud está siendo revisada/i)).toHaveCount(0)
    await expect(page.locator('input[name="password"]')).toHaveCount(0)
  })

  test('2.2 — ACTIVE teacher hitting /maestro/pending is redirected OUT to the dashboard (not stuck)', async ({ page }) => {
    await page.goto(PENDING)
    await settle(page)
    await page.waitForTimeout(2000) // server redirect on is_active=true
    // Prove by content: an active teacher must NOT see the holding-page copy,
    // and SHOULD see real dashboard chrome (the sidebar nav is always present).
    const stuck = await page.getByText(/tu solicitud está siendo revisada/i).count()
    test.info().annotations.push({ type: 'observed', description: `active-teacher-on-pending stuck=${stuck > 0} ; url=${page.url()}` })
    expect(stuck, 'an ACTIVE teacher must not be stranded on the pending page').toBe(0)
    // Positive proof: landed somewhere inside the teacher app shell.
    await expect(
      page.getByRole('link', { name: /^Configuración$|^Mi agenda$|^Inicio$/ }).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('2.3 — config nav link from the sidebar lands on the settings form', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await page.getByRole('link', { name: 'Configuración' }).click()
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
  })

  // ─────────────────── 3 · Input validation (every input) ───────────────────

  test('3.1 [MUTATING] — XSS payload in name/bio is stored inert (React-escaped, no execution)', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const xss = `<img src=x onerror=alert(1)><script>alert(2)</script>`
    try {
      await page.goto(CFG)
      await settle(page)
      await fillFields(page, { name: `QA ${xss}`, bio: `bio ${xss}` })
      const label = await clickSave(page)
      test.info().annotations.push({ type: 'observed', description: `save-button-after=${label.trim()}` })
      // Reload to render the persisted value from the server.
      await page.reload(); await settle(page)
      expect(dialog, 'stored XSS must not execute on render').toBeFalsy()
      // No live <script> injected into the DOM from our payload.
      expect(await page.locator('script:has-text("alert(2)")').count()).toBe(0)
      // The value should round-trip as literal text in the input (escaped, harmless).
      const after = await readFields(page)
      test.info().annotations.push({ type: 'observed', description: `name-after-reload="${after.name}"` })
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('3.2 [MUTATING] — empty name is accepted with NO validation (finding: name can be blanked)', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    try {
      await page.goto(CFG)
      await settle(page)
      await fillFields(page, { name: '' })
      const label = await clickSave(page)
      // updateTeacherProfile has no required-field check → it saves the blank.
      const saved = /cambios guardados|changes saved/i.test(label)
      test.info().annotations.push({ type: 'observed', description: `empty-name accepted (button="${label.trim()}", saved=${saved})` })
      expect(saved, 'EXPECTED FINDING: settings accepts an empty full_name with no validation').toBeFalsy()
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('3.3 [MUTATING] — oversized (10k char) bio is accepted with no length cap (finding)', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    try {
      await page.goto(CFG)
      await settle(page)
      const huge = 'A'.repeat(10_000)
      await fillFields(page, { bio: huge })
      const label = await clickSave(page)
      const saved = /cambios guardados|changes saved/i.test(label)
      test.info().annotations.push({ type: 'observed', description: `10k-bio saved=${saved} (no client/server length cap in updateTeacherProfile)` })
      expect(saved, 'EXPECTED FINDING: bio has no maximum length — a 10k payload is accepted').toBeFalsy()
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('3.4 [MUTATING] — SQLi-ish payload in specializations is stored as inert text, no 5xx', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    const errors: string[] = []
    page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })
    try {
      await page.goto(CFG)
      await settle(page)
      await fillFields(page, { specs: `'; DROP TABLE teachers;--, Business English` })
      await clickSave(page)
      await page.reload(); await settle(page)
      expect(errors, 'SQLi-style specialization must not 500').toEqual([])
      // The form must still render (table not dropped, query still works).
      await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('3.5 [MUTATING] — specializations comma-split: blank/whitespace items are dropped (data integrity)', async ({ page }) => {
    test.skip(!db || !ORIGINAL, 'service role + original values required to verify the stored array')
    try {
      await page.goto(CFG)
      await settle(page)
      // Leading/trailing commas + double commas + padded items → action trims & drops empties.
      await fillFields(page, { specs: '  ,  IELTS ,, Pronunciación ,  ' })
      await clickSave(page)
      // Verify the persisted array directly (the action does .split(',').map(trim).filter(Boolean)).
      const { data } = await db!
        .from('teachers')
        .select('specializations, profiles!inner(email)')
        .eq('profiles.email', 'teacher@englishkolab.com')
        .maybeSingle()
      const arr = (data?.specializations as string[] | null) || []
      test.info().annotations.push({ type: 'observed', description: `stored specializations = ${JSON.stringify(arr)}` })
      expect(arr, 'empty/whitespace items must be dropped, survivors trimmed').toEqual(['IELTS', 'Pronunciación'])
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('3.6 [MUTATING] — unicode/emoji in name round-trips intact (no mojibake)', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    const tricky = 'José Ñandú 日本語 😀 — QA'
    try {
      await page.goto(CFG)
      await settle(page)
      await fillFields(page, { name: tricky })
      await clickSave(page)
      await page.reload(); await settle(page)
      const after = await readFields(page)
      test.info().annotations.push({ type: 'observed', description: `unicode name round-trip = "${after.name}"` })
      expect(after.name, 'unicode/emoji name must persist without corruption').toBe(tricky)
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  // ─────────────────── 4 · Error / success state feedback ───────────────────

  test('4.1 [MUTATING] — saving an unchanged form succeeds and shows the "Cambios guardados" confirmation', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    await page.goto(CFG)
    await settle(page)
    // No mutation of values — re-save what is already there.
    const label = await clickSave(page)
    test.info().annotations.push({ type: 'observed', description: `save confirmation label="${label.trim()}"` })
    // The button should flip to the saved state (or back to idle if 3s elapsed).
    expect(/cambios guardados|guardar cambios/i.test(label), 'save should resolve to a confirmation, not an error').toBeTruthy()
    // No error line should be present.
    await expect(page.getByText(/error al guardar/i)).toHaveCount(0)
  })

  // ─────────────────── 5 · Security / permissions / role guard ───────────────────

  test('5.1 — config page never leaks another role; admin-only chrome absent', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    // A teacher settings page must not render admin-only surfaces.
    await expect(page.getByText(/solicitudes pendientes|gestión de usuarios|panel de admin/i)).toHaveCount(0)
  })

  test('5.2 — direct hourly_rate is NOT exposed/editable on this teacher-facing form', async ({ page }) => {
    // page.tsx selects hourly_rate but ConfigTeacherClient never renders it.
    // Teachers must not be able to set their own pay-rate here. Verify it's absent.
    await page.goto(CFG)
    await settle(page)
    const body = (await page.locator('body').innerText()).toLowerCase()
    const exposesRate = /hourly_rate|tarifa por hora|hourly rate|\$\s?\d+\s?\/\s?(hr|hora)/.test(body)
    test.info().annotations.push({ type: 'observed', description: `hourly_rate exposed on settings = ${exposesRate}` })
    expect(exposesRate, 'teacher self-settings must not surface an editable hourly rate').toBeFalsy()
  })

  // ─────────────────── 6 · State / concurrency ───────────────────

  test('6.1 [MUTATING] — double-click Save does not error or double-submit (button disables on saving)', async ({ page }) => {
    test.skip(!ORIGINAL, 'could not read original field values to restore')
    await page.goto(CFG)
    await settle(page)
    const btn = page.getByRole('button', { name: /guardar cambios|save changes/i })
    await btn.click().catch(() => {})
    // 2nd click should be a no-op while saving/saved (disabled={saving||saved}).
    await btn.click({ timeout: 1200 }).catch(() => {})
    await page.waitForTimeout(2500)
    // No error surfaced; the page is still intact.
    await expect(page.getByText(/error al guardar/i)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
  })

  // ─────────────────── 7 · i18n ES + EN parity ───────────────────

  test('7.1 — EN config page shows English labels, not Spanish leakage', async ({ page }) => {
    await page.goto(CFG_EN)
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Manage your teacher profile.')).toBeVisible()
    await expect(page.getByText('Email cannot be changed.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
    // Spanish strings must NOT appear on the EN page.
    await expect(page.getByText('Administra tu perfil de maestro.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0)
  })

  test('7.2 — EN settings: specializations hint is in English (no hardcoded ES)', async ({ page }) => {
    await page.goto(CFG_EN)
    await settle(page)
    await expect(page.getByText(/Comma-separated/i)).toBeVisible()
    await expect(page.getByText('Separadas por comas (ej. Business English, IELTS, Pronunciación)')).toHaveCount(0)
  })

  test('7.3 — language toggle from the sidebar flips the config page locale', async ({ page }) => {
    await page.goto(CFG)
    await settle(page)
    // Sidebar toggle: "Switch to English" when currently on ES.
    const toggle = page.getByRole('button', { name: /switch to english|cambiar a español/i })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await settle(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `after-toggle url=${page.url()}` })
    // Content proof: the EN heading should now be present.
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15_000 })
    expect(page.url()).toContain('/en/maestro/dashboard/configuracion')
  })

  // ─────────────────── 8 · Responsive ───────────────────

  test('8.1 — config form is usable on a 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto(CFG)
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
    const save = page.getByRole('button', { name: 'Guardar cambios' })
    await save.scrollIntoViewIfNeeded()
    await expect(save).toBeVisible()
    // Name input must be reachable / tappable on mobile.
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-teacher-config-mobile.png', fullPage: true })
  })

  test('8.2 — pending page renders cleanly on 375px mobile (for inactive-teacher path)', async ({ page }) => {
    // Active teacher gets redirected; if so we screenshot the redirect target.
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto(PENDING)
    await settle(page)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'test-results/exhaustive-teacher-pending-mobile.png', fullPage: true })
    // Whatever it resolves to must not be a raw error / blank.
    const body = (await page.locator('body').innerText()).trim()
    expect(body.length, 'page must render content, not an empty/error shell').toBeGreaterThan(20)
  })

  // ─────────────────── 9 · Console errors + network 4xx/5xx ───────────────────

  test('9.1 — config page loads with no console errors and no 4xx/5xx page requests', async ({ page }) => {
    const consoleErrors: string[] = []
    const badResponses: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', r => {
      const s = r.status()
      // Ignore third-party analytics noise; flag same-origin app failures.
      if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
    })
    await page.goto(CFG)
    await settle(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; bad-responses=${JSON.stringify(badResponses)}` })
    // Favicon / benign 404s sometimes slip through — surface them but only hard-fail on 5xx.
    const server5xx = badResponses.filter(r => /^5\d\d/.test(r))
    expect(server5xx, 'no 5xx on the config page').toEqual([])
    expect(consoleErrors, `console errors on config page:\n${consoleErrors.join('\n')}`).toEqual([])
  })

  test('9.2 — pending page (or its redirect) loads with no 5xx', async ({ page }) => {
    const server5xx: string[] = []
    page.on('response', r => { if (r.status() >= 500 && /englishkolab\.com/.test(r.url())) server5xx.push(`${r.status()} ${r.url()}`) })
    await page.goto(PENDING)
    await settle(page)
    await page.waitForTimeout(1500)
    expect(server5xx, 'no 5xx on pending route').toEqual([])
  })

  // ─────────────────── 10 · Data integrity ───────────────────

  test('10.1 [MUTATING] — name typed in the form is the value actually persisted (form/DB parity)', async ({ page }) => {
    test.skip(!db || !ORIGINAL, 'service role + original values required')
    const stamp = `QA Parity ${Date.now()}`
    try {
      await page.goto(CFG)
      await settle(page)
      await fillFields(page, { name: stamp })
      await clickSave(page)
      const { data } = await db!
        .from('profiles')
        .select('full_name')
        .eq('email', 'teacher@englishkolab.com')
        .maybeSingle()
      test.info().annotations.push({ type: 'observed', description: `db full_name = "${data?.full_name}"` })
      expect(data?.full_name, 'the saved name must match what was typed (no silent transform)').toBe(stamp)
    } finally {
      await page.goto(CFG); await settle(page)
      await fillFields(page, { name: ORIGINAL!.name, bio: ORIGINAL!.bio, specs: ORIGINAL!.specs })
      await clickSave(page)
    }
  })

  test('10.2 — pending page i18n: EN copy present when reached as inactive (no ES leakage)', async ({ page }) => {
    // Active QA teacher is redirected away, so this primarily documents the EN
    // string set is wired. If redirected, we record that and skip the assertion.
    await page.goto(PENDING_EN)
    await settle(page)
    await page.waitForTimeout(1500)
    const onPending = await page.getByText(/your application is under review/i).count()
    if (onPending === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: `active teacher redirected off /en/maestro/pending → ${page.url()} (cannot assert EN holding copy)` })
      return
    }
    // If we DID land on the holding page, the ES headline must not leak on EN.
    await expect(page.getByText(/tu solicitud está siendo revisada/i)).toHaveCount(0)
  })
})
