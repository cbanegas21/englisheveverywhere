/**
 * Real UI-driven auth lifecycle — the coverage that was missing (audit RC9).
 *
 * Unlike auth.spec.ts / password-reset.spec.ts (which admin-provision users and
 * assert source strings), this drives the actual registro UI to a DURABLE session,
 * then logs out, logs in, resets the password, and logs in with the new one. It is
 * the test that would have caught the signup-won't-log-you-in loop (RC1) and the
 * reset link pointing at the old vercel domain (RC2/S5).
 *
 * The service-role admin client is used ONLY to (a) read the real recovery
 * action_link and (b) tear down the throwaway user — never to provision it.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Mirror fixtures/manageUsers: load .env.local so the admin client has creds.
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
  } catch { /* .env.local optional */ }
})()

function makeAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const db = makeAdmin()
const EMAIL = `e2e-ui-${Date.now()}@englishkolab.test`
const PASSWORD = 'E2eUi1234!'
const NEW_PASSWORD = 'E2eUi5678!'

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

test.describe.configure({ mode: 'serial' })

test.describe('auth lifecycle (real UI)', () => {
  test.skip(!db, 'service-role key required — set SUPABASE_SERVICE_ROLE_KEY or .env.local')

  test.afterAll(async () => {
    if (!db) return
    const user = await findUser(db, EMAIL)
    if (user) {
      await db.from('profiles').delete().eq('id', user.id)
      await db.auth.admin.deleteUser(user.id)
    }
  })

  test('sign up through the UI lands you logged in (RC1)', async ({ page, context }) => {
    await page.goto('/es/registro')

    // Step 1 — role: pick the Estudiante card (advances to the form step).
    await page.getByRole('button', { name: /Estudiante/ }).click()

    // Step 2 — form (now: first/last name, email, phone, password, confirm).
    await page.fill('input[name="first_name"]', 'E2E')
    await page.fill('input[name="last_name"]', 'Tester')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="phone"]', '50488000000')
    await page.fill('input[name="password"]', PASSWORD)
    await page.fill('input[name="confirm_password"]', PASSWORD)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()

    // Must land INSIDE the app — not bounced to /login or back to the role step.
    await page.waitForURL(/\/es\/(onboarding|dashboard)/, { timeout: 30_000 })
    expect(hasAuthCookie(await context.cookies())).toBeTruthy()
  })

  test('log out, then log in with the same credentials (RC3)', async ({ page, context }) => {
    await page.goto('/es/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await page.waitForURL(/\/es\/(dashboard|onboarding)/, { timeout: 30_000 })
    await expect(page.getByText(/Correo o contraseña inválidos/i)).toHaveCount(0)
    expect(hasAuthCookie(await context.cookies())).toBeTruthy()
  })

  test('password mismatch is caught on the form, no submit', async ({ page }) => {
    await page.goto('/es/registro')
    await page.getByRole('button', { name: /Estudiante/ }).click()
    await page.fill('input[name="first_name"]', 'Mis')
    await page.fill('input[name="last_name"]', 'Match')
    await page.fill('input[name="email"]', `e2e-mismatch-${Date.now()}@englishkolab.test`)
    await page.fill('input[name="phone"]', '50488000001')
    await page.fill('input[name="password"]', PASSWORD)
    await page.fill('input[name="confirm_password"]', 'Different9!')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByText(/no coinciden/i)).toBeVisible()
    await expect(page).toHaveURL(/\/es\/registro/) // never navigated into the app
  })

  test('re-registering an existing email shows the error ON THE FORM', async ({ page }) => {
    await page.goto('/es/registro')
    await page.getByRole('button', { name: /Estudiante/ }).click()
    await page.fill('input[name="first_name"]', 'Dup')
    await page.fill('input[name="last_name"]', 'Licate')
    await page.fill('input[name="email"]', EMAIL) // created in test 1
    await page.fill('input[name="phone"]', '50488000002')
    await page.fill('input[name="password"]', PASSWORD)
    await page.fill('input[name="confirm_password"]', PASSWORD)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    // Stays on the form with a clear message — does NOT silently trap on the role step.
    await expect(page.getByText(/ya tiene una cuenta|already has an account/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('recovery link targets englishkolab.com and reset works (RC2/RC3)', async ({ page }) => {
    expect(db).not.toBeNull()
    const { data, error } = await db!.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
    expect(error).toBeNull()

    // S5/S6 guard: the action_link is always the Supabase /auth/v1/verify host;
    // the destination the user actually lands on is its `redirect_to` param, which
    // Supabase fills from site_url. That must be englishkolab.com, not vercel.app.
    const actionLink = data!.properties!.action_link
    const redirectTo = new URL(actionLink).searchParams.get('redirect_to') || ''
    expect(new URL(redirectTo).host).toBe('englishkolab.com')

    // Drive the local new-password page with the real recovery token_hash.
    const tokenHash = data!.properties!.hashed_token
    await page.goto(`/es/login/new-password?token_hash=${tokenHash}&type=recovery`)

    // The form only appears once the recovery session is established (RC3 gate).
    const pwInput = page.locator('input[type="password"]')
    await expect(pwInput).toBeVisible({ timeout: 20_000 })
    await pwInput.fill(NEW_PASSWORD)
    await page.getByRole('button', { name: /Actualizar contraseña/ }).click()
    await page.waitForURL(/\/es\/(dashboard|onboarding|intake)/, { timeout: 30_000 })
  })

  test('log in with the NEW password', async ({ page }) => {
    await page.goto('/es/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', NEW_PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await page.waitForURL(/\/es\/(dashboard|onboarding)/, { timeout: 30_000 })
  })
})
