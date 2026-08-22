// Does the inactivity timeout actually fire on LIVE, or is it fail-open again?
//
// qa-e2e-shell.mjs backdates the `ee-seen` marker by EXACTLY 4h and expects a
// bounce, but the proxy checks `now - lastSeen > SESSION_IDLE_MS` (strictly
// greater, 4h) — so that test sits on a knife edge and its comment still says
// "3h", i.e. it predates the window change. A stale test and a fail-open
// security control look identical from a red line, so probe the boundary:
// well past the window, just past it, and well inside it.
//
// June 2026 history: this control WAS fail-open once (the marker's maxAge equalled
// the window, so a returning idle session carried no marker → NaN → logout skipped).
import { chromium } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'

const R = E.reporter('IDLE TIMEOUT boundary')
const WINDOW_H = 4
let stu
const b = await chromium.launch()

// Backdate the marker by `hours` and navigate to a guarded page.
async function probe(email, pass, hours) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-HN', timezoneId: 'America/Tegucigalpa' })
  const p = await ctx.newPage()
  await p.goto(`${E.BASE}/es/login`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', pass)
  await p.click('button[type=submit]')
  await p.waitForTimeout(4000)
  const loggedIn = /\/dashboard/.test(p.url())

  await ctx.addCookies([{
    name: 'ee-seen',
    value: String(Date.now() - hours * 3600000),
    domain: 'englishkolab.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }])
  await p.goto(`${E.BASE}/es/dashboard/clases`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)

  const url = p.url()
  const sb = (await ctx.cookies()).filter(c => c.name.startsWith('sb-') && c.value).length
  await ctx.close()
  return { loggedIn, url, bounced: /\/login/.test(url) && /timeout=1/.test(url), sb }
}

try {
  stu = await E.mkStudent({ tag: 'idle', credits: 1 })
  R.ok('stage throwaway student', !!stu.sid)

  // Well PAST the window — must sign out. This is the security-relevant case.
  const far = await probe(stu.email, stu.pass, WINDOW_H + 6)
  R.ok('login succeeded before probing', far.loggedIn)
  R.ok(`idle ${WINDOW_H + 6}h (well past ${WINDOW_H}h window) → bounced to /login?timeout=1`, far.bounced, far.url)
  R.ok(`idle ${WINDOW_H + 6}h → Supabase session cookies CLEARED`, far.sb === 0, `sb cookies=${far.sb}`)

  // Comfortably past the window — must also sign out.
  const past = await probe(stu.email, stu.pass, WINDOW_H + 0.5)
  R.ok(`idle ${WINDOW_H + 0.5}h (just past window) → bounced`, past.bounced, past.url)

  // Well INSIDE the window — must stay signed in (no over-eager logout).
  const inside = await probe(stu.email, stu.pass, WINDOW_H - 1)
  R.ok(`idle ${WINDOW_H - 1}h (inside window) → still signed in`, !inside.bounced && /dashboard/.test(inside.url), inside.url)
  R.ok(`idle ${WINDOW_H - 1}h → session cookies retained`, inside.sb > 0, `sb cookies=${inside.sb}`)
} catch (e) {
  R.ok('probe completed without throwing', false, String(e).slice(0, 180))
} finally {
  await b.close()
  if (stu) await E.nukeStudent(stu).catch(() => {})
  R.summary()
}
