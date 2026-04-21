import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Tier 2.4 — Password reset / change flow.
 *
 * The app supports only ONE password-change path: `/login/reset` (request
 * reset email) → email link → `/login/new-password?code=…` (set new
 * password). Logged-in users' "Cambiar contraseña" links in the settings
 * pages point to the same `/login/reset` entry — there is NO "enter current
 * password + new password" flow inside the dashboard.
 *
 * Full email round-trip is not practical in tests (no email read access in
 * this environment), so coverage splits three ways:
 *
 *   1. Public reset-request UI — `/login/reset` renders the form, submits to
 *      `resetPassword` server action, lands on `?success=reset` success screen.
 *      Regression guard for a future PR that drops the form input or changes
 *      the redirect landing.
 *
 *   2. new-password page guards — `/login/new-password` without a `code`
 *      query param shows the "invalid/expired link" error. Catches a
 *      regression where the code-missing guard is accidentally removed (the
 *      page would otherwise render a form with no session, then throw on
 *      updateUser).
 *
 *   3. Supabase password-update contract — a throwaway user's sign-in
 *      credential flips when `admin.updateUserById({ password })` is called.
 *      This is the SAME RPC that `new-password/page.tsx:67` calls via
 *      `supabase.auth.updateUser({ password })` after
 *      `exchangeCodeForSession`. If the underlying Supabase auth primitive
 *      breaks (misconfigured JWT secret, SMTP config that blocks updates,
 *      etc.), this test red-flags first — separating "our code broke" from
 *      "Supabase broke" in future regressions.
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

interface ThrowawayUser {
  userId: string
  email: string
  password: string
  admin: SupabaseClient
  anonClient: SupabaseClient
  cleanup: () => Promise<void>
}

async function makeThrowawayStudent(): Promise<ThrowawayUser | null> {
  const admin = getAdmin()
  if (!admin) return null

  const stamp = Date.now() + Math.floor(Math.random() * 10000)
  const email = `e2e-pw-${stamp}@englishkolab.test`
  const password = 'InitialPw1234!'

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `PW Probe ${stamp}`, role: 'student' },
  })
  if (error || !created.user) return null

  const userId = created.user.id
  await admin.from('profiles').upsert(
    { id: userId, email, full_name: `PW Probe ${stamp}`, role: 'student' },
    { onConflict: 'id' },
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return {
    userId,
    email,
    password,
    admin,
    anonClient,
    cleanup: async () => { try { await admin.auth.admin.deleteUser(userId) } catch {} },
  }
}

test.describe('Tier 2.4 — Password reset / change flow', () => {
  test('public /login/reset submits email and shows success screen', async ({ page }) => {
    // Doesn't need a real account — the server action never leaks whether
    // the email exists (by design, line 170-177 of actions/auth.ts). Any
    // syntactically-valid email works for exercising the form path.
    await page.goto('/es/login/reset')
    await expect(page.getByRole('heading', { name: /Restablecer contraseña/i }))
      .toBeVisible({ timeout: 10_000 })

    await page.fill('input[name="email"]', 'no-such-user@englishkolab.test')
    await page.getByRole('button', { name: /Enviar enlace/i }).click()

    // Server action redirects to `/${lang}/login?success=reset` (NOT the reset
    // page itself — `resetPassword` in actions/auth.ts:177). The login page
    // then renders a green banner using `tx.successReset`
    // ("Revisa tu bandeja de entrada." / "Check your inbox for a recovery
    // email.") above the login form. The page heading stays "Ingresar a tu
    // cuenta" because we're on the login route now.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/\/login\?.*success=reset/)
    await expect(
      page.getByText(/Revisa tu bandeja de entrada|Check your inbox for a recovery email/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('/login/new-password without code shows expired-link error', async ({ page }) => {
    // Security-adjacent guard: the page MUST refuse to render the password
    // form when no code is in the URL, otherwise a malicious visitor could
    // manually craft a submit to updateUser against whichever session the
    // browser happens to hold. The page handles this by setting
    // status='error' + errorSession message; the form is hidden.
    await page.goto('/es/login/new-password')

    const errorMessage = page.getByText(/Enlace inválido o expirado|Invalid or expired reset link/i)
    await expect(errorMessage).toBeVisible({ timeout: 10_000 })

    // Password input + submit button must NOT render when the session isn't
    // ready (the page gates the form on `sessionReady` after code exchange).
    await expect(page.getByRole('button', { name: /Actualizar contraseña|Update password/i }))
      .toHaveCount(0)
  })

  test('contract: admin updateUserById flips the password — old creds stop working, new ones work', async () => {
    const u = await makeThrowawayStudent()
    test.skip(!u, 'admin creds unavailable — cannot provision throwaway user')

    try {
      // Baseline — sign in with the initial password must succeed.
      const initialSignIn = await u!.anonClient.auth.signInWithPassword({
        email: u!.email,
        password: u!.password,
      })
      expect(initialSignIn.error, 'initial password must work before rotation').toBeNull()
      expect(initialSignIn.data?.user?.id).toBe(u!.userId)

      // Rotate the password via the same admin primitive that
      // `new-password/page.tsx` uses on the client side
      // (`supabase.auth.updateUser({ password })` — both land in the same
      // Supabase GoTrue endpoint).
      const newPassword = 'RotatedPw5678!'
      const { error: updateErr } = await u!.admin.auth.admin.updateUserById(
        u!.userId,
        { password: newPassword },
      )
      expect(updateErr, 'password rotation via admin API should succeed').toBeNull()

      // Old password must now fail. Use a FRESH anon client so no lingering
      // session masks the failure.
      const freshUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const freshKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const freshClient = createClient(freshUrl, freshKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const oldPwAttempt = await freshClient.auth.signInWithPassword({
        email: u!.email,
        password: u!.password,
      })
      expect(
        oldPwAttempt.error,
        'old password MUST reject after rotation — otherwise password change is a no-op',
      ).toBeTruthy()
      expect(oldPwAttempt.data?.session, 'old password must not return a session').toBeFalsy()

      // New password must succeed.
      const newPwAttempt = await freshClient.auth.signInWithPassword({
        email: u!.email,
        password: newPassword,
      })
      expect(newPwAttempt.error, 'new password must be accepted after rotation').toBeNull()
      expect(newPwAttempt.data?.user?.id).toBe(u!.userId)
    } finally {
      await u!.cleanup()
    }
  })

  test('source: new-password page calls exchangeCodeForSession then updateUser({ password })', () => {
    // The client-side primitive chain is the contract. If a refactor drops
    // exchangeCodeForSession, the page would try to updateUser on whatever
    // session the browser happens to hold — hijacking risk. If it drops
    // updateUser, no password change happens at all.
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/[lang]/login/new-password/page.tsx'),
      'utf8',
    )

    expect(
      /exchangeCodeForSession\s*\(\s*code\s*\)/.test(src),
      'must call exchangeCodeForSession(code) with the ?code param',
    ).toBe(true)

    expect(
      /updateUser\s*\(\s*\{\s*password/.test(src),
      'must call updateUser({ password }) after successful code exchange',
    ).toBe(true)

    // The order matters — the exchange must precede the update call. A naive
    // split that reverses them would let the page update a random session's
    // password. Sanity-check the exchange appears first in the file.
    const exchangeIdx = src.search(/exchangeCodeForSession/)
    const updateIdx = src.search(/updateUser\s*\(\s*\{\s*password/)
    expect(exchangeIdx, 'both calls must exist').toBeGreaterThan(-1)
    expect(updateIdx, 'both calls must exist').toBeGreaterThan(-1)
    expect(
      exchangeIdx < updateIdx,
      'exchangeCodeForSession must come before updateUser in the source',
    ).toBe(true)
  })
})
