// Prove BOTH halves of the /login/new-password hardening:
//
//   A. HOLE CLOSED  — an ordinary logged-in session, with NO recovery token in the
//      URL, can no longer set a new password (CWE-620). It used to be accepted:
//      establish() ended in `return !!session`, so a borrowed unlocked browser
//      could take the account over permanently and evict the real owner.
//
//   B. FLOW INTACT  — the genuine recovery flow still works end to end. The
//      Supabase recovery template uses {{ .TokenHash }} (verified via the
//      Management API), i.e. ?token_hash=...&type=recovery -> verifyOtp, which the
//      hardening deliberately leaves untouched.
//
// B mints the link with the GoTrue admin API rather than reading mail: throwaway
// accounts use @example.com, a reserved domain Resend will not deliver to, so no
// message is ever created. The URL is byte-identical in shape to the emailed one.
import { chromium } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'

const R = E.reporter('PASSWORD RESET verify')
const NEW_PW = 'QaReset2026!New'
let stu
const b = await chromium.launch()

// Mint a REAL recovery link via the GoTrue admin API instead of waiting on mail.
// Why: throwaway accounts use @example.com, a reserved domain Resend refuses to
// deliver to, so no message is ever created. generate_link produces the exact
// same ?token_hash=...&type=recovery URL the {{ .TokenHash }} template emits, so
// this exercises the identical verifyOtp branch — the one the hardening had to
// leave working — without depending on mail delivery.
async function recoveryLink(email, lang = 'es') {
  const res = await fetch(`${E.SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: E.SRK, Authorization: `Bearer ${E.SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email, options: { redirect_to: `${E.BASE}/${lang}/login/new-password` } }),
  })
  const j = await res.json().catch(() => null)
  const hashed = j?.properties?.hashed_token || j?.hashed_token
  if (!hashed) return null
  return `${E.BASE}/${lang}/login/new-password?token_hash=${hashed}&type=recovery`
}

try {
  stu = await E.mkStudent({ tag: 'pwreset', credits: 0 })
  R.ok('stage throwaway student', !!stu.sid, stu.email)

  // ── A. the hole: ordinary session, no token in the URL ───────────────────
  {
    const { ctx, p } = await E.loginCtx(b, stu.email, stu.pass, { lang: 'es' })
    const loggedIn = /\/dashboard/.test(p.url())
    R.ok('A: throwaway student is genuinely logged in first', loggedIn, p.url())

    await p.goto(`${E.BASE}/es/login/new-password`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(3500)
    const pwInputs = await p.locator('input[type="password"]').count()
    const body = (await p.locator('body').innerText().catch(() => '')) || ''
    R.ok('A: ⭐ a plain session can NO LONGER reach the set-password form',
      pwInputs === 0, `password inputs=${pwInputs}`)
    R.ok('A: it shows the invalid/expired-link message instead',
      /inv[aá]lido|expirado|invalid|expired/i.test(body),
      body.replace(/\s+/g, ' ').slice(0, 110))
    await p.screenshot({ path: 'docs/_qa-evidence/pw-plain-session-refused.png' }).catch(() => {})
    await ctx.close()
  }

  // ── B. the real recovery-token flow must still work ─────────────────────
  {
    const link = await recoveryLink(stu.email)
    R.ok('B: minted a real recovery token_hash link', !!link, link ? link.slice(0, 76) + '…' : 'generate_link failed')

    if (link) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } })
      const p = await ctx.newPage()
      await p.goto(link, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(4500)
      const pwInputs = await p.locator('input[type="password"]').count()
      R.ok('B: ⭐ the REAL recovery link still opens the set-password form', pwInputs > 0, `password inputs=${pwInputs}`)
      await p.screenshot({ path: 'docs/_qa-evidence/pw-real-link-works.png' }).catch(() => {})

      if (pwInputs > 0) {
        const fields = p.locator('input[type="password"]')
        for (let i = 0; i < pwInputs; i++) await fields.nth(i).fill(NEW_PW).catch(() => {})
        await p.locator('button[type=submit]').first().click().catch(() => {})
        await p.waitForTimeout(5500)
      }
      await ctx.close()

      // The only proof that matters: sign in with the NEW password.
      const { ctx: c2, p: p2 } = await E.loginCtx(b, stu.email, NEW_PW, { lang: 'es' })
      R.ok('B: ⭐ the student can log in with the NEW password', /\/dashboard/.test(p2.url()), p2.url())
      await c2.close()
    }
  }

} catch (e) {
  R.ok('verification completed without throwing', false, String(e).slice(0, 200))
} finally {
  await b.close()
  if (stu) await E.nukeStudent(stu).catch(() => {})
  R.summary()
}
