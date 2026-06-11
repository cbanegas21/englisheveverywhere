/**
 * EXHAUSTIVE LEGAL / CONTACT SWEEP — /es|/en/{privacy,terms,contact}
 *
 * PUBLIC surface (no auth) → NO storageState. Three static server components:
 *   - src/app/[lang]/contact/page.tsx   (Contáctanos / Contact us)
 *   - src/app/[lang]/terms/page.tsx     (Términos del Servicio / Terms of Service)
 *   - src/app/[lang]/privacy/page.tsx   (Política de Privacidad / Privacy Policy)
 *
 * GROUND TRUTH read from source (no guessed selectors / labels):
 *   - Support email is `hola@englishkolab.com` EVERYWHERE (contact page CONTACT_EMAIL,
 *     terms/privacy CONTACT_EMAIL, Footer SUPPORT_EMAIL). It must NEVER be a gmail.
 *   - Contact page has NO form — it exposes a mailto:hola@englishkolab.com link/button
 *     and a WhatsApp link https://wa.me/50488902191 (WHATSAPP_NUMBER = '50488902191').
 *   - EFFECTIVE_DATE = 'April 21, 2026' (a hardcoded English date string shown on BOTH
 *     locales — probed as an i18n observation, NOT a hard fail).
 *   - Operator entity = "Remote ACKtive LLC", Wyoming, USA.
 *   - Footer Company column links to /<lang>/{privacy,terms,contact}; footer has an
 *     ES/EN locale switch (Links to /es and /en) + a serif mailto:hola@englishkolab.com.
 *   - Navbar has an ES/EN toggle <button aria-label="Switch to EN|ES">.
 *
 * Probes are non-mutating (static pages, no forms). NEVER asserts on a mid-redirect URL —
 * asserts on rendered content. Uses settle() (no networkidle), no describe.serial.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle } from './_exhaustive/helpers'

const SUPPORT_EMAIL = 'hola@englishkolab.com'
const WHATSAPP_NUMBER = '50488902191'
const GMAIL_LEAK = /[a-z0-9._%+-]+@gmail\.com/i

// Per-page identity for parametric probes. `titleEs`/`titleEn` are the exact <h1> text.
const PAGES = [
  { key: 'privacy', titleEs: 'Política de Privacidad', titleEn: 'Privacy Policy', hasEffective: true },
  { key: 'terms', titleEs: 'Términos del Servicio', titleEn: 'Terms of Service', hasEffective: true },
  { key: 'contact', titleEs: 'Contáctanos', titleEn: 'Contact us', hasEffective: false },
] as const

// Collect console errors + 4xx/5xx for a page. Returns getters used in assertions.
function instrument(page: Page) {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('response', r => {
    const s = r.status()
    // Ignore the favicon/analytics noise that is irrelevant to the legal pages.
    if (s >= 400 && !/favicon|\.well-known|vercel-insights|va\.vercel/.test(r.url())) {
      badResponses.push(`${s} ${r.url()}`)
    }
  })
  return { consoleErrors, badResponses }
}

test.describe('EXHAUSTIVE LEGAL / CONTACT (public)', () => {
  // ─────────────────────── 1 · Happy-path render (ES default + EN) ───────────────────────

  for (const lang of ['es', 'en'] as const) {
    for (const p of PAGES) {
      test(`1 — /${lang}/${p.key} renders its real ${lang.toUpperCase()} heading + content`, async ({ page }) => {
        await page.goto(`/${lang}/${p.key}`)
        await settle(page)
        const title = lang === 'es' ? p.titleEs : p.titleEn
        // Heading is the source of truth for "right page + right locale".
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
        // The shared chrome rendered too (footer entity line present on every page).
        await expect(page.getByText(/Remote ACKtive LLC/).first()).toBeVisible()
        test.info().annotations.push({ type: 'observed', description: `/${lang}/${p.key} h1="${title}" url=${page.url()}` })
        await page.screenshot({ path: `test-results/exhaustive-legal-${p.key}-${lang}.png`, fullPage: true })
      })
    }
  }

  // ─────────────────────── SUPPORT EMAIL = hola@ (NOT gmail) — the headline check ───────────────────────

  for (const lang of ['es', 'en'] as const) {
    for (const p of PAGES) {
      test(`SUPPORT — /${lang}/${p.key} body never leaks a personal gmail`, async ({ page }) => {
        await page.goto(`/${lang}/${p.key}`)
        await settle(page)
        const body = await page.locator('body').innerText()
        const gmailHit = body.match(GMAIL_LEAK)
        test.info().annotations.push({ type: gmailHit ? 'SECURITY' : 'observed', description: `gmail-leak=${gmailHit ? gmailHit[0] : 'none'} on /${lang}/${p.key}` })
        expect(gmailHit, `support contact must be ${SUPPORT_EMAIL}, never a personal gmail`).toBeNull()
        // And the correct address IS present (contact page surfaces it as a link; terms/privacy in body text).
        expect(body, `expected ${SUPPORT_EMAIL} somewhere on the page`).toContain(SUPPORT_EMAIL)
      })
    }
  }

  test('SUPPORT — contact page mailto button targets hola@englishkolab.com (not gmail)', async ({ page }) => {
    await page.goto('/es/contact')
    await settle(page)
    const mailtos = await page.locator(`a[href^="mailto:"]`).evaluateAll(els => els.map(e => (e as HTMLAnchorElement).getAttribute('href')))
    test.info().annotations.push({ type: 'observed', description: `mailto hrefs: ${mailtos.join(' | ')}` })
    expect(mailtos.length, 'contact page must expose at least one mailto link').toBeGreaterThan(0)
    for (const href of mailtos) {
      expect(href, 'mailto must point at the support inbox').toBe(`mailto:${SUPPORT_EMAIL}`)
    }
    // Visible CTA label is the real Spanish string.
    await expect(page.getByRole('link', { name: 'Escríbenos' })).toBeVisible()
  })

  // ─────────────────────── 2 · Entry / nav: deep-link, refresh, default-locale, role guard ───────────────────────

  test('2 — bare /privacy (no lang) routes to a localized legal page (proxy locale resolution)', async ({ page }) => {
    await page.goto('/privacy')
    await settle(page)
    // Content proof, not URL — the proxy should land us on ES (default) or EN privacy.
    await expect(page.getByRole('heading', { level: 1, name: /Política de Privacidad|Privacy Policy/ })).toBeVisible()
    test.info().annotations.push({ type: 'observed', description: `/privacy resolved to ${page.url()}` })
  })

  test('2 — deep-link + hard refresh keeps the terms page rendered (no SSR hydration blank)', async ({ page }) => {
    await page.goto('/es/terms')
    await settle(page)
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Términos del Servicio' })).toBeVisible()
    // A real section deep in the doc proves the full static tree re-rendered.
    await expect(page.getByRole('heading', { name: '11. Ley aplicable y disputas' })).toBeVisible()
  })

  test('2 — legal pages are PUBLIC for an unauthenticated visitor (no login bounce)', async ({ page, context }) => {
    // No storageState in this describe → this context is genuinely anonymous.
    await context.clearCookies()
    await page.goto('/es/privacy')
    await settle(page)
    // Must show the policy, NOT a login form.
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidad' })).toBeVisible()
    expect(await page.locator('input[name="password"]').count(), 'legal pages must not be gated behind login').toBe(0)
  })

  // ─────────────────────── 3 · Input / param fuzzing on the [lang] segment ───────────────────────

  test('3 — junk/SQLi/XSS/oversized [lang] segment does not 500 or execute script', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const { badResponses } = instrument(page)
    const vectors = [
      'fr',                                   // unsupported but plausible locale
      'ES',                                   // wrong-case
      "'; DROP TABLE profiles;--",            // SQLi
      '<script>alert(1)</script>',            // XSS
      '%2e%2e%2f%2e%2e%2f',                   // path traversal (encoded)
      'a'.repeat(2000),                       // oversized
      '日本語',                                // unicode
    ]
    const server500: string[] = []
    for (const v of vectors) {
      const resp = await page.goto(`/${encodeURIComponent(v)}/privacy`, { waitUntil: 'domcontentloaded' }).catch(() => null)
      await settle(page, 800)
      const status = resp?.status() ?? 0
      if (status >= 500) server500.push(`${v} → ${status}`)
      // Never reflect the XSS vector as live markup.
      const xssLive = await page.locator('script:has-text("alert(1)")').count()
      expect(xssLive, `XSS in [lang]=${v} must not become live <script>`).toBe(0)
    }
    test.info().annotations.push({ type: 'observed', description: `5xx vectors: ${server500.join(', ') || 'none'}; page-5xx: ${badResponses.filter(b => /^5/.test(b)).join(', ') || 'none'}` })
    expect(dialog, 'no XSS dialog from [lang] fuzzing').toBeFalsy()
    expect(server500, 'no 5xx from [lang] fuzzing').toEqual([])
  })

  // ─────────────────────── 4 · Error / failure states (unknown legal sub-path) ───────────────────────

  test('4 — unknown legal-ish path /es/cookies returns a handled 404 (not a 500)', async ({ page }) => {
    const resp = await page.goto('/es/cookies', { waitUntil: 'domcontentloaded' }).catch(() => null)
    await settle(page, 800)
    const status = resp?.status() ?? 0
    test.info().annotations.push({ type: 'observed', description: `/es/cookies → HTTP ${status}` })
    expect(status, 'a missing legal page should 404, never 5xx').toBeLessThan(500)
  })

  // ─────────────────────── 5 · Security: external links + WhatsApp safety ───────────────────────

  test('5 — contact WhatsApp link targets the configured number with safe rel/target', async ({ page }) => {
    await page.goto('/es/contact')
    await settle(page)
    const wa = page.locator(`a[href^="https://wa.me/"]`)
    const count = await wa.count()
    test.info().annotations.push({ type: 'observed', description: `wa.me links found = ${count}` })
    // WhatsApp section only renders when a number is configured (it is: 50488902191).
    expect(count, 'WhatsApp CTA should render when a number is configured').toBeGreaterThan(0)
    const href = await wa.first().getAttribute('href')
    expect(href, 'wa.me must point at the configured support number').toBe(`https://wa.me/${WHATSAPP_NUMBER}`)
    // External tab must be safe.
    expect(await wa.first().getAttribute('target')).toBe('_blank')
    expect(await wa.first().getAttribute('rel') || '').toContain('noopener')
    await expect(page.getByRole('link', { name: 'Abrir WhatsApp' })).toBeVisible()
  })

  test('5 — footer Company links resolve to the real legal pages (cross-page nav integrity)', async ({ page }) => {
    await page.goto('/es/contact')
    await settle(page)
    // Footer Company column: Privacidad → /es/privacy.
    const privacyLink = page.locator(`footer a[href="/es/privacy"]`)
    await expect(privacyLink).toBeVisible()
    await privacyLink.click()
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidad' })).toBeVisible()
  })

  // ─────────────────────── 7 · i18n ES↔EN parity + locale toggle ───────────────────────

  test('7 — Navbar ES/EN toggle on a legal page swaps the page to the other locale', async ({ page }) => {
    await page.goto('/es/terms')
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Términos del Servicio' })).toBeVisible()
    // Navbar toggle: <button aria-label="Switch to EN"> (from /es).
    await page.getByRole('button', { name: /Switch to EN/i }).click()
    await settle(page, 2500)
    // Content proof of the locale swap (not a URL snapshot).
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible()
    test.info().annotations.push({ type: 'observed', description: `after toggle url=${page.url()}` })
  })

  test('7 — footer locale switch (/en link) flips the privacy page to English', async ({ page }) => {
    await page.goto('/es/privacy')
    await settle(page)
    await page.locator(`footer a[href="/en"]`).click()
    await settle(page, 2000)
    // The footer /en link lands on the EN home; assert EN chrome rendered (not a URL guess).
    const body = await page.locator('body').innerText()
    test.info().annotations.push({ type: 'observed', description: `footer /en → ${page.url()}` })
    expect(body, 'EN footer/home strings should appear').toMatch(/Privacy|Terms|Contact/)
  })

  test('7 — terms ES↔EN are genuine translations, not the same string twice (parity)', async ({ page }) => {
    await page.goto('/es/terms'); await settle(page)
    const es = await page.locator('main').innerText()
    await page.goto('/en/terms'); await settle(page)
    const en = await page.locator('main').innerText()
    expect(es).toContain('Términos del Servicio')
    expect(en).toContain('Terms of Service')
    // ES must NOT contain the English heading and vice-versa (catches a copy-paste locale bug).
    expect(es, 'ES terms must not render the English title').not.toContain('Terms of Service')
    expect(en, 'EN terms must not render the Spanish title').not.toContain('Términos del Servicio')
  })

  test('7 — i18n OBSERVATION: effective-date string is the English "April 21, 2026" on the ES page', async ({ page }) => {
    // EFFECTIVE_DATE is a hardcoded English string rendered on BOTH locales. This is a known
    // i18n smell; record it (annotation) but do NOT hard-fail (it is by design in source today).
    await page.goto('/es/privacy')
    await settle(page)
    const effective = await page.getByText(/Fecha de vigencia/).innerText()
    const usesEnglishMonth = /April/i.test(effective)
    test.info().annotations.push({ type: 'i18n', description: `ES privacy effective line = "${effective}" (englishMonth=${usesEnglishMonth})` })
    // Soft assert: the localized label is present (the date format is the noted smell).
    expect(effective).toMatch(/Fecha de vigencia/)
  })

  // ─────────────────────── 8 · Responsive (375px mobile + desktop) ───────────────────────

  test('8 — contact page is usable on a 375px mobile viewport (CTAs in viewport, no overflow)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/contact')
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Contáctanos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Escríbenos' })).toBeInViewport()
    // No horizontal scroll bleed at 375px.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `375px horizontal overflow = ${overflow}px` })
    expect(overflow, 'no horizontal overflow at 375px').toBeLessThanOrEqual(2)
    await page.screenshot({ path: 'test-results/exhaustive-legal-contact-mobile.png', fullPage: true })
  })

  test('8 — privacy long-form reads on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/privacy')
    await settle(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `privacy 375px overflow = ${overflow}px` })
    expect(overflow).toBeLessThanOrEqual(2)
  })

  // ─────────────────────── 9 · Console errors + network 4xx/5xx on each page ───────────────────────

  for (const p of PAGES) {
    test(`9 — /es/${p.key} loads with no console errors and no 4xx/5xx`, async ({ page }) => {
      const { consoleErrors, badResponses } = instrument(page)
      await page.goto(`/es/${p.key}`)
      await settle(page, 2500)
      test.info().annotations.push({ type: 'observed', description: `console-errors=[${consoleErrors.join(' || ')}] bad-responses=[${badResponses.join(' || ')}]` })
      expect(consoleErrors, `console errors on /es/${p.key}`).toEqual([])
      expect(badResponses, `4xx/5xx on /es/${p.key}`).toEqual([])
    })
  }

  // ─────────────────────── 10 · Data integrity: entity + email consistency across all 6 pages ───────────────────────

  test('10 — operator entity + support email are identical across all 6 legal/contact pages', async ({ page }) => {
    const seenEmails = new Set<string>()
    const missingEntity: string[] = []
    for (const lang of ['es', 'en'] as const) {
      for (const p of PAGES) {
        await page.goto(`/${lang}/${p.key}`)
        await settle(page, 600)
        const body = await page.locator('body').innerText()
        if (!/Remote ACKtive LLC/.test(body)) missingEntity.push(`/${lang}/${p.key}`)
        for (const m of body.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) seenEmails.add(m[0].toLowerCase())
      }
    }
    test.info().annotations.push({ type: 'observed', description: `emails seen across legal pages: ${[...seenEmails].join(', ')}` })
    expect(missingEntity, 'every legal/contact page must name the operating entity').toEqual([])
    // The ONLY contact email anywhere should be the support inbox — flag any stray address.
    const stray = [...seenEmails].filter(e => e !== SUPPORT_EMAIL)
    expect(stray, `unexpected non-support email(s) on legal pages: ${stray.join(', ')}`).toEqual([])
  })
})
