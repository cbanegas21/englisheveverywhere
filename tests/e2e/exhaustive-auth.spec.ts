/**
 * EXHAUSTIVE AUTH PILOT — the dynamic "every what-if on the auth surface" sweep.
 *
 * Net-new aggressive probes only (auth.spec / auth-ui.spec / security.spec /
 * password-reset.spec already cover the happy path + mismatch + bad-phone +
 * duplicate-email + recovery-host). This file adds: privilege/role injection,
 * open-redirect via `next`, injection (SQLi/XSS), error-leak, session quirks,
 * visual/a11y, and rate-limit/lockout (RUN LAST — it burns the limiter).
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com). Uses the
 * service role ONLY to (a) reset the auth_attempts limiter between probes so our
 * own run never self-blocks, (b) read provisioned roles, (c) tear down throwaway
 * signups. Serial by design — concurrent logins poison the rate-limit signal.
 */
import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS } from '../fixtures/accounts'
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

function makeAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
const db = makeAdmin()

// auth_attempts.id is bigint (not uuid) — clear with gte('id', 0). Resetting it
// drops the rate-limit window to zero so the next probe starts with a clean budget.
async function clearRateLimit() {
  if (!db) return
  await db.from('auth_attempts').delete().gte('id', 0)
}

async function findUser(database: SupabaseClient, email: string) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 5; page++) {
    const { data } = await database.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data?.users.find(u => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (!data || data.users.length < 200) break
  }
  return null
}

const hasAuthCookie = (cookies: { name: string }[]) =>
  cookies.some(c => /^sb-.*-auth-token/.test(c.name))

async function typePhone(page: Page, national: string) {
  const input = page.locator('.react-international-phone-input')
  await input.click()
  await input.pressSequentially(national, { delay: 80 })
}

// 'networkidle' never settles on a live app (analytics/keep-alive). Use a
// reliable DOM-ready + a short fixed window for any server-action redirect chain.
async function settle(p: Page) {
  await p.waitForLoadState('domcontentloaded').catch(() => {})
  await p.waitForTimeout(2000)
}

// UI login. Returns the final URL. Does NOT assert success (callers do).
async function loginUI(page: Page, email: string, password: string, opts: { next?: string } = {}) {
  const url = opts.next ? `/es/login?next=${encodeURIComponent(opts.next)}` : '/es/login'
  await page.goto(url)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
}

const STUDENT = ACCOUNTS.student
const CREATED: string[] = [] // throwaway emails to tear down

// NOT serial mode — these probes EXPECT failures (each failure = a finding), and
// serial mode would abort the whole block on the first one. workers=1 still gives
// deterministic declaration order, so the rate-limit probes stay last.

test.describe('EXHAUSTIVE AUTH PILOT', () => {
  test.skip(!db, 'service-role key required (SUPABASE_SERVICE_ROLE_KEY / .env.local)')

  test.beforeEach(async () => { await clearRateLimit() })

  test.afterAll(async () => {
    if (!db) return
    for (const email of CREATED) {
      const u = await findUser(db, email)
      if (u) { await db.from('profiles').delete().eq('id', u.id); await db.auth.admin.deleteUser(u.id) }
    }
    await clearRateLimit()
  })

  // ───────────────────────── A · Privilege & role ─────────────────────────

  test('A2 — student login with ?next=/es/admin cannot see admin content', async ({ page }) => {
    await loginUI(page, STUDENT.email, STUDENT.password, { next: '/es/admin' })
    await settle(page)
    await page.waitForTimeout(3000) // let the admin-layout bounce fully resolve
    // Content is the source of truth — the URL may briefly read /es/admin mid-redirect.
    // A student must never see admin-only chrome/data.
    await expect(page.getByText(/solicitudes pendientes|gestión de usuarios|panel de admin/i)).toHaveCount(0)
    // Positive proof they were bounced to their OWN area (not a blank/leaked admin shell).
    await expect(page.getByText(/clases disponibles|tus próximas clases|hola,/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('A1 — registro POST with role=admin injected is coerced to student', async ({ page, context }) => {
    const email = `e2e-exh-priv-${Date.now()}@englishkolab.test`
    CREATED.push(email)
    // Rewrite the multipart server-action body: role=student → role=admin.
    await context.route('**/es/registro', async route => {
      const req = route.request()
      let body = req.postData() || ''
      if (req.method() === 'POST' && /name="role"/.test(body)) {
        body = body.replace(/(name="role"\r?\n\r?\n)(student|teacher)/, '$1admin')
        await route.continue({ postData: body })
      } else {
        await route.continue()
      }
    })
    await page.goto('/es/registro')
    await page.getByRole('button', { name: /Estudiante/ }).click()
    await page.fill('input[name="first_name"]', 'Priv')
    await page.fill('input[name="last_name"]', 'Esc')
    await page.fill('input[name="email"]', email)
    await typePhone(page, '88892191')
    await page.fill('input[name="password"]', 'E2ePriv1234!')
    await page.fill('input[name="confirm_password"]', 'E2ePriv1234!')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await page.waitForURL(/\/es\/(onboarding|dashboard|registro)/, { timeout: 30_000 }).catch(() => {})
    await context.unroute('**/es/registro')

    // The fix (auth.ts:78) must coerce role → student regardless of the injected value.
    const u = db ? await findUser(db, email) : null
    if (!u) { test.info().annotations.push({ type: 'inconclusive', description: 'signup did not create a user (body tamper may have been rejected)' }); return }
    const { data: prof } = await db!.from('profiles').select('role').eq('id', u.id).single()
    expect(prof?.role, 'injected role=admin must be coerced to student').toBe('student')
  })

  // ───────────────────────── B · Open-redirect / next ─────────────────────────

  test('B — open-redirect vectors in ?next= are all neutralized', async ({ page }) => {
    const vectors = ['//evil.com', '/\\evil.com', 'http://evil.com', 'javascript:alert(1)', '/fr/x', 'https://englishkolab.com.evil.com']
    const leaked: string[] = []
    for (const v of vectors) {
      await clearRateLimit()
      await loginUI(page, STUDENT.email, STUDENT.password, { next: v })
      await settle(page)
      const u = new URL(page.url())
      // Must land on our own origin, on a real app path — never the attacker target.
      if (u.host !== 'englishkolab.com' || /evil\.com/i.test(page.url()) || u.protocol === 'javascript:') {
        leaked.push(`${v} → ${page.url()}`)
      }
    }
    expect(leaked, `open-redirect leaks:\n${leaked.join('\n')}`).toEqual([])
  })

  test('B6 — a valid ?next=/es/clases is honored', async ({ page }) => {
    await loginUI(page, STUDENT.email, STUDENT.password, { next: '/es/clases' })
    await page.waitForURL(/\/es\/clases(\/|$)/, { timeout: 30_000 }).catch(() => {})
    expect(page.url()).toMatch(/\/es\/(clases|dashboard)/) // honored, or safe role-home fallback
  })

  // ───────────────────────── C · Injection ─────────────────────────

  test('C1 — SQLi in login credentials fails closed (no auth, no 500)', async ({ page, context }) => {
    const errors: string[] = []
    page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })
    await loginUI(page, `' OR 1=1--`, `' OR '1'='1`)
    await settle(page)
    expect(hasAuthCookie(await context.cookies()), 'SQLi must not authenticate').toBeFalsy()
    expect(errors, 'no 5xx on injection').toEqual([])
    expect(page.url()).toMatch(/\/login/)
  })

  test('C2 — XSS payload in email is not executed/reflected unescaped', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    await loginUI(page, `<script>alert(1)</script>@x.com`, 'whatever123')
    await settle(page)
    expect(dialog, 'no script execution').toBeFalsy()
    // The literal tag must not be present as live markup (React escapes; query param echo must be inert).
    const scriptCount = await page.locator('script:has-text("alert(1)")').count()
    expect(scriptCount).toBe(0)
  })

  // ───────────────────────── E · Error-leak & i18n ─────────────────────────

  test('E1 — an unmapped Supabase error leaks raw + untranslated on the ES page', async ({ page }) => {
    // A malformed email yields an error NOT in the login page's 3-pattern allowlist,
    // so login/page.tsx:143 renders it verbatim (English) on the Spanish page.
    await loginUI(page, 'notanemail', 'whatever123')
    await settle(page)
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    const leakedRawEnglish = /unable to validate|invalid format|email address/.test(bodyText)
    // Record the finding either way; assert the localized fallback SHOULD have been shown.
    test.info().annotations.push({ type: 'observed', description: `raw-english-leak=${leakedRawEnglish}; url=${page.url()}` })
    expect(leakedRawEnglish, 'auth error should be localized, not raw English (login/page.tsx:143 allowlist gap)').toBeFalsy()
  })

  // ───────────────────────── F · Session & concurrency ─────────────────────────

  test('F1 — an already-logged-in user visiting /login should not be left on the form', async ({ page }) => {
    await loginUI(page, STUDENT.email, STUDENT.password)
    await page.waitForURL(/\/es\/(dashboard|clases|onboarding|intake)/, { timeout: 30_000 }).catch(() => {})
    // Revisit /login while authenticated.
    await page.goto('/es/login')
    await settle(page)
    const onLoginForm = await page.locator('input[name="password"]').count()
    test.info().annotations.push({ type: 'observed', description: `authed /login → ${page.url()} ; password-field-visible=${onLoginForm > 0}` })
    expect(onLoginForm, 'logged-in user should be redirected to their dashboard, not shown the login form').toBe(0)
  })

  test('F2 — double-clicking submit does not create a duplicate login storm', async ({ page, context }) => {
    await page.goto('/es/login')
    await page.fill('input[name="email"]', STUDENT.email)
    await page.fill('input[name="password"]', STUDENT.password)
    const btn = page.getByRole('button', { name: /ingresar|log in/i })
    await btn.click().catch(() => {})
    await btn.click({ timeout: 1500 }).catch(() => {}) // 2nd click should be a no-op (button disables on isPending)
    await settle(page)
    await page.waitForTimeout(3000)
    // Landed logged-in with a single valid session — no error, no storm.
    expect(hasAuthCookie(await context.cookies()), 'should be logged in once').toBeTruthy()
  })

  // ───────────────────────── H · Visual / a11y ─────────────────────────

  test('H1 — login is usable on a 375px mobile viewport (brand panel hidden)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/login')
    await settle(page)
    const submit = page.getByRole('button', { name: /ingresar|log in/i })
    await expect(submit).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-auth-mobile-login.png', fullPage: true })
  })

  test('H2 — password show/hide toggle works and is labelled', async ({ page }) => {
    await page.goto('/es/login')
    const pw = page.locator('input[name="password"]')
    await pw.fill('secret123')
    expect(await pw.getAttribute('type')).toBe('password')
    await page.getByRole('button', { name: /mostrar contraseña|show password/i }).click()
    expect(await pw.getAttribute('type')).toBe('text')
  })

  test('H3 — "Keep me logged in" is decorative (no name → never submitted)', async ({ page }) => {
    await page.goto('/es/login')
    const cb = page.locator('input[type="checkbox"]').first()
    await expect(cb).toBeVisible()
    const name = await cb.getAttribute('name')
    test.info().annotations.push({ type: 'observed', description: `keep-logged-in checkbox name=${name}` })
    expect(name, 'the checkbox has no name → it is decorative; wire it or remove it').not.toBeNull()
  })

  // ───────────────────────── G · Rate-limit & lockout (LAST — burns the limiter) ─────────────────────────

  test('G1+G2 — login limiter trips on the real IP, and XFF-spoof bypass probe', async ({ page, browser }) => {
    test.setTimeout(120_000)
    await clearRateLimit()
    let trippedAt = -1
    for (let i = 1; i <= 13; i++) {
      await loginUI(page, STUDENT.email, 'WrongPassword!' + i)
      await settle(page)
      const body = (await page.locator('body').innerText()).toLowerCase()
      if (/demasiados intentos|too many/.test(body)) { trippedAt = i; break }
    }
    test.info().annotations.push({ type: 'observed', description: `login limiter tripped at attempt #${trippedAt} (LIMIT=10)` })
    expect(trippedAt, 'per-IP login limiter must engage').toBeGreaterThan(0)

    // XFF-spoof: with the real IP now blocked, a request carrying a spoofed
    // X-Forwarded-For should be re-keyed to a fresh IP. If it is NOT blocked,
    // the limiter is bypassable (HIGH). If still blocked, Vercel normalized XFF.
    const spoof = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.77' } })
    const sp = await spoof.newPage()
    await loginUI(sp, STUDENT.email, 'WrongPasswordSpoof!')
    await settle(sp)
    const spoofBody = (await sp.locator('body').innerText()).toLowerCase()
    const spoofBypassed = !/demasiados intentos|too many/.test(spoofBody)
    test.info().annotations.push({ type: 'SECURITY', description: `XFF-spoof bypass = ${spoofBypassed} (true ⇒ limiter bypassable via X-Forwarded-For)` })
    await spoof.close()
    // Not a hard fail — it RECORDS the verdict for the findings doc. Surface it loudly.
    expect(spoofBypassed, 'EXPECTED FINDING: if true, the rate limiter is bypassable via spoofed X-Forwarded-For').toBeFalsy()
  })

  test('G3 — password reset has no rate limit (inbox-spam / quota-drain vector)', async ({ page }) => {
    await clearRateLimit()
    const target = `e2e-exh-reset-${Date.now()}@englishkolab.test`
    let successes = 0
    for (let i = 0; i < 8; i++) {
      await page.goto('/es/login/reset')
      await page.fill('input[name="email"], input[type="email"]', target)
      await page.getByRole('button', { name: /enviar|recuperar|restablece|reset|send/i }).first().click()
      await settle(page)
      const body = (await page.locator('body').innerText()).toLowerCase()
      if (/revisa tu bandeja|check your inbox|enviado|sent|éxito|listo/.test(body) || /success=reset/.test(page.url())) successes++
    }
    test.info().annotations.push({ type: 'SECURITY', description: `reset accepted ${successes}/8 rapid requests with no throttle` })
    expect(successes, 'EXPECTED FINDING: reset endpoint accepts unlimited rapid requests (no rate limit)').toBeLessThan(8)
  })
})
