// §7.1 GLOBAL SHELL & SESSION — dynamic PROD checks: branded localized 404 / error
// pages, invalid-locale → 404, 4h inactivity timeout, logout clears the session,
// proxy role redirect, the mobile-nav drawer a11y (role=dialog + Escape + scroll
// lock), and the language toggle persisting app-wide.
// Run: node scripts/qa-e2e-shell.mjs
import { chromium, devices } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'

const { ok, summary } = E.reporter('E2E SHELL & SESSION (§7.1)')
const b = await chromium.launch()
let S
try {
  await E.cleanLogins()

  // ── Branded localized 404 (anon) — not Next's English default ───────────────
  {
    const p = await (await b.newContext()).newPage()
    for (const [path, marker, lang] of [
      ['/es/zzz-nope-' + Date.now(), /no encontramos esta página|página no encontrada/i, 'es'],
      ['/en/zzz-nope-' + Date.now(), /couldn.t find this page|page not found/i, 'en'],
      ['/fr/dashboard', /no encontramos esta página|página no encontrada/i, 'es (invalid-locale→404)'],
    ]) {
      const r = await p.goto(`${E.BASE}${path}`, { waitUntil: 'domcontentloaded' })
      const body = ((await p.locator('body').textContent().catch(() => '')) || '')
      ok(`404 ${lang}: branded localized page (not Next default)`, marker.test(body) && !/This page could not be found/i.test(body), `http=${r?.status()} hasMarker=${marker.test(body)}`)
    }
    await p.context().close()
  }

  // Stage a throwaway student for the session-bound checks.
  S = await E.mkStudent({ tag: 'shellS', credits: 1, lang: 'es' })

  // ── 4h inactivity timeout (proxy LIVE-004) ──────────────────────────────────
  {
    const { ctx, p } = await E.loginCtx(b, S.email, S.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/dashboard`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok('inactivity: fresh session reaches the dashboard', /\/dashboard/.test(p.url()), p.url())
    // Backdate the activity marker PAST the window and navigate — the proxy must
    // sign out. The window is SESSION_IDLE_MS = 4h and the proxy tests strictly
    // `now - lastSeen > window`, so backdating by exactly 4h sits on the boundary
    // and flaps. Use a clear margin. (Boundary itself is covered by
    // scripts/qa-idle-boundary.mjs: 10h and 4.5h sign out, 3h stays in.)
    await ctx.addCookies([{ name: 'ee-seen', value: String(Date.now() - 6 * 3600000), domain: 'englishkolab.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
    await p.goto(`${E.BASE}/es/dashboard/clases`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok('inactivity: idle > 4h → bounced to /login?timeout=1', /\/login/.test(p.url()) && /timeout=1/.test(p.url()), p.url())
    const cookies = await ctx.cookies()
    ok('inactivity: Supabase session cookies cleared on timeout', !cookies.some(c => c.name.startsWith('sb-') && c.value), `sb cookies=${cookies.filter(c => c.name.startsWith('sb-') && c.value).length}`)
    await ctx.close()
  }

  // ── Logout clears the session (in this tab) ─────────────────────────────────
  {
    const { ctx, p } = await E.loginCtx(b, S.email, S.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/dashboard`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    await p.getByRole('button', { name: /Cerrar sesión|Sign out/i }).first().click().catch(() => {})
    await p.waitForTimeout(3000)
    const cookies = await ctx.cookies()
    ok('logout: Supabase session cookies cleared', !cookies.some(c => c.name.startsWith('sb-') && c.value), `sb=${cookies.filter(c => c.name.startsWith('sb-') && c.value).length}`)
    await p.goto(`${E.BASE}/es/dashboard`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200)
    ok('logout: protected page now redirects to /login', /\/login/.test(p.url()), p.url())
    await ctx.close()
  }

  // ── Proxy role redirect: student → /admin is bounced to their home ──────────
  {
    const { ctx, p } = await E.loginCtx(b, S.email, S.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/admin/overview`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok('proxy: student visiting /admin is redirected off it (to own home)', !/\/admin/.test(p.url()), p.url())
    await ctx.close()
  }

  // ── Language toggle persists app-wide (ee-locale) ───────────────────────────
  {
    const { ctx, p } = await E.loginCtx(b, S.email, S.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/dashboard`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    await p.getByRole('button', { name: /Switch to English|Cambiar a Inglés/i }).first().click().catch(() => {})
    await p.waitForTimeout(2000)
    ok('lang toggle: ES→EN navigates to /en', /\/en\//.test(p.url()), p.url())
    const cookies = await ctx.cookies()
    ok('lang toggle: ee-locale cookie persisted = en', cookies.find(c => c.name === 'ee-locale')?.value === 'en', `ee-locale=${cookies.find(c => c.name === 'ee-locale')?.value}`)
    // navigate again — stays EN
    await p.goto(`${E.BASE}/en/dashboard/clases`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200)
    ok('lang toggle: EN persists across navigation', /\/en\//.test(p.url()), p.url())
    await ctx.close()
  }

  // ── Mobile-nav drawer a11y: role=dialog + Escape + scroll lock ──────────────
  {
    const ctx = await b.newContext({ ...devices['iPhone 13'] })
    const p = await ctx.newPage()
    await p.goto(`${E.BASE}/es/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600)
    await p.fill('input[type=email]', S.email); await p.fill('input[type=password]', S.pass)
    await p.click('button[type=submit]'); await p.waitForTimeout(3500)
    await p.goto(`${E.BASE}/es/dashboard`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    const hamburger = p.getByRole('button', { name: /Abrir menú|Open menu/i }).first()
    ok('mobile: hamburger present', await hamburger.count() >= 1, `count=${await hamburger.count()}`)
    await hamburger.click().catch(() => {}); await p.waitForTimeout(700)
    const dialog = p.locator('[role="dialog"][aria-modal="true"]')
    ok('mobile drawer: role=dialog + aria-modal present', await dialog.count() >= 1, `count=${await dialog.count()}`)
    const overflow = await p.evaluate(() => document.body.style.overflow)
    ok('mobile drawer: body scroll locked while open', overflow === 'hidden', `overflow=${overflow}`)
    await p.keyboard.press('Escape'); await p.waitForTimeout(700)
    ok('mobile drawer: Escape closes it', await p.locator('[role="dialog"][aria-modal="true"]').count() === 0, `still open=${await p.locator('[role="dialog"][aria-modal="true"]').count()}`)
    const overflow2 = await p.evaluate(() => document.body.style.overflow)
    ok('mobile drawer: body scroll restored after close', overflow2 !== 'hidden', `overflow=${overflow2}`)
    await ctx.close()
  }

  summary()
} catch (e) {
  console.log('SUITE ERR', e.message, e.stack)
  summary()
} finally {
  if (S) await E.nukeStudent(S)
  await E.cleanLogins()
  await b.close()
  console.log('=== cleanup done ===')
}
