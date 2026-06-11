/**
 * EXHAUSTIVE LANDING — the dynamic "every what-if on the marketing landing" sweep.
 *
 * Surface: the public marketing landing at /es (default) and /en. Role: PUBLIC,
 * so NO storageState (a saved session would flip the navbar/hero CTAs to the
 * logged-in variant and mask the public happy-path). Runs against LIVE
 * (PLAYWRIGHT_BASE_URL=https://englishkolab.com).
 *
 * Selectors + Spanish/English copy below were extracted verbatim from the real
 * components — NOT guessed:
 *   src/app/[lang]/page.tsx          (section order, ee-role cookie login check)
 *   src/components/landing/Navbar.tsx        (nav anchors, ES/EN toggle button)
 *   src/components/landing/Hero.tsx          (headline, CTAs → /registro, #how-it-works)
 *   src/components/landing/HowItWorks.tsx    (id="how-it-works", 4 steps)
 *   src/components/landing/Teachers.tsx      (id="teachers", "Un maestro. El tuyo.")
 *   src/components/landing/Pricing.tsx       (id="pricing", PRICING_PLANS, CTAs)
 *   src/components/landing/FAQ.tsx           (id="faq", accordion, WhatsApp/mailto)
 *   src/components/landing/FinalCTA.tsx      (CTAs → /registro, ?intent=discovery)
 *   src/components/landing/Footer.tsx        (privacy/terms/contact, locale links)
 *   src/proxy.ts                             (ee-locale cookie, / → /es redirect)
 *
 * The 10-dimension what-if matrix is covered, tailored to a public marketing page:
 * render, nav/deep-link/refresh/role-guard, input (n/a — no inputs, so we probe
 * the URL/locale params instead), error states, security/permissions, state
 * (locale persistence/two-tab), i18n ES+EN parity, responsive 375px, console/
 * network errors, data integrity. Plus the CONFIDENTIALITY guard: the landing
 * must NEVER expose a teacher roster/count ("N maestros / N teachers").
 *
 * NON-MUTATING: the landing has no forms or writes. Nothing here mutates.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle } from './_exhaustive/helpers'

// ── Exact copy lifted from the components (used for ES↔EN parity assertions) ──
const COPY = {
  es: {
    heroEyebrow: 'Inglés en vivo · 1 a 1',
    heroTitle: /Cuando/i,
    heroAccent: /quieras\./i,
    heroCtaPrimary: 'Empezar ahora',
    heroCtaSecondary: 'Ver cómo funciona',
    navHow: 'Cómo funciona',
    navTeachers: 'Maestros',
    navPricing: 'Precios',
    navFaq: 'Preguntas',
    navLogin: 'Iniciar sesión',
    navCta: 'Empezar',
    teachersTitle: 'Un maestro.',
    teachersAccent: 'El tuyo.',
    faqEyebrow: 'Preguntas',
    finalCta: 'Empezar ahora',
    finalGhost: 'Clase de descubrimiento gratis',
    footerTagline: 'Aprende inglés. Cuando quieras. Donde quieras. A tu ritmo.',
    footerContact: 'Contacto',
    footerPrivacy: 'Privacidad',
    footerTerms: 'Términos',
  },
  en: {
    heroEyebrow: 'Live English · 1 to 1',
    heroTitle: /Whenever/i,
    heroAccent: /you want\./i,
    heroCtaPrimary: 'Get started',
    heroCtaSecondary: 'See how it works',
    navHow: 'How it works',
    navTeachers: 'Teachers',
    navPricing: 'Pricing',
    navFaq: 'Questions',
    navLogin: 'Log in',
    navCta: 'Get started',
    teachersTitle: 'One teacher.',
    teachersAccent: 'Yours.',
    faqEyebrow: 'Questions',
    finalCta: 'Get started',
    finalGhost: 'Free discovery class',
    footerTagline: 'Learn English. Anytime. Anywhere. At your pace.',
    footerContact: 'Contact',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
  },
} as const

const SECTION_IDS = ['how-it-works', 'teachers', 'pricing', 'faq'] as const

// Plan display names (from src/lib/pricing.ts) — must appear on the rendered page.
const PLAN_NAMES = { es: ['Partida', 'Trayecto', 'Ascenso', 'Cumbre'], en: ['Departure', 'Journey', 'Ascent', 'Summit'] } as const

// Wire up console + network capture for a page; returns accessors.
function watch(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('response', r => {
    const s = r.status()
    // Document/navigation + same-origin asset failures are what matter; ignore
    // 3xx (redirects are expected) and cross-origin analytics noise is filtered
    // by callers when needed. Record 4xx/5xx for the page's own origin.
    if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
  })
  return { consoleErrors, pageErrors, badResponses }
}

test.describe('EXHAUSTIVE LANDING (public)', () => {
  // PUBLIC surface — explicitly NO storageState. Stay logged-out.

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  for (const lang of ['es', 'en'] as const) {
    test(`render — /${lang} paints hero + every section with no page errors`, async ({ page }) => {
      const w = watch(page)
      await page.goto(`/${lang}`)
      await settle(page)

      // H1 hero headline visible (content, not URL).
      const h1 = page.getByRole('heading', { level: 1 }).first()
      await expect(h1).toBeVisible()
      await expect(h1).toContainText(COPY[lang].heroTitle)

      // Hero eyebrow proves the right locale rendered (not a fallback).
      await expect(page.getByText(COPY[lang].heroEyebrow, { exact: false }).first()).toBeVisible()

      // Every anchored section is present in the DOM (the page is whole, not blank/truncated).
      const missing: string[] = []
      for (const id of SECTION_IDS) {
        if (await page.locator(`#${id}`).count() === 0) missing.push(id)
      }
      expect(missing, `sections missing from /${lang}: ${missing.join(', ')}`).toEqual([])

      // Pricing plan names render (data integrity — pricing.ts is the source).
      for (const name of PLAN_NAMES[lang]) {
        await expect(page.getByText(name, { exact: false }).first()).toBeVisible()
      }

      test.info().annotations.push({ type: 'observed', description: `/${lang} pageErrors=${w.pageErrors.length} consoleErrors=${w.consoleErrors.length} 4xx5xx=${w.badResponses.length}` })
      await page.screenshot({ path: `test-results/exhaustive-landing-render-${lang}.png`, fullPage: true })

      expect(w.pageErrors, `uncaught page errors on /${lang}:\n${w.pageErrors.join('\n')}`).toEqual([])
    })
  }

  // ───────────────────────── 2 · Entry / nav / deep-link / refresh ─────────────────────────

  test('root "/" redirects to the default /es landing (content-proven)', async ({ page }) => {
    await page.goto('/')
    await settle(page)
    // Prove via rendered Spanish content, not a mid-redirect URL snapshot.
    await expect(page.getByText(COPY.es.heroEyebrow, { exact: false }).first()).toBeVisible()
    expect(page.url(), 'final landed URL should be the /es landing').toMatch(/\/es(\/|$|\?|#)/)
  })

  test('deep-link to a section anchor scrolls to that section (#pricing)', async ({ page }) => {
    await page.goto('/es#pricing')
    await settle(page)
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
    // Anchored section must be scrolled into view, not parked at the top.
    await expect(pricing).toBeInViewport({ ratio: 0.05 })
    const scrollY = await page.evaluate(() => window.scrollY)
    test.info().annotations.push({ type: 'observed', description: `#pricing deep-link scrollY=${scrollY}` })
    expect(scrollY, 'deep-link to #pricing should scroll the page down from the hero').toBeGreaterThan(100)
  })

  test('navbar anchor links jump to the matching in-page section', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    // The desktop nav anchor "Precios" → /es#pricing. Use the header scope to
    // avoid matching the footer's "Precios" link.
    const header = page.locator('header')
    await header.getByRole('link', { name: COPY.es.navPricing, exact: true }).click()
    await settle(page, 1200)
    await expect(page.locator('#pricing')).toBeInViewport({ ratio: 0.05 })
    expect(page.url()).toMatch(/#pricing$/)
  })

  test('refresh on a deep anchor preserves the section render', async ({ page }) => {
    await page.goto('/es#faq')
    await settle(page)
    await page.reload()
    await settle(page)
    await expect(page.locator('#faq')).toBeVisible()
    await expect(page.getByText(COPY.es.faqEyebrow, { exact: true }).first()).toBeVisible()
  })

  // Role guard: a public marketing page must remain reachable by EVERY role.
  // We don't load a real session (that's other specs); we set the cookie-only
  // fast-path role (ee-role) the landing reads, to prove proxy.ts does NOT
  // bounce a logged-in role away from the public marketing page.
  for (const role of ['student', 'teacher', 'admin'] as const) {
    test(`role guard — a logged-in ${role} (ee-role cookie) still sees the landing`, async ({ page, context }) => {
      await context.addCookies([
        { name: 'ee-role', value: role, domain: 'englishkolab.com', path: '/' },
      ])
      await page.goto('/es')
      await settle(page)
      // proxy.ts only redirects /dashboard|/maestro|/admin mismatches — never the
      // bare landing. The page must render (content proof, not URL).
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      // And the navbar CTA should flip to the logged-in "Ir al Dashboard" variant.
      const dash = await page.getByRole('link', { name: /Ir al Dashboard/i }).count()
      test.info().annotations.push({ type: 'observed', description: `${role}: landing rendered; dashboard-cta-visible=${dash > 0}` })
      expect(page.url(), 'landing must not redirect a logged-in role away').toMatch(/\/es(\/|$|#)/)
    })
  }

  // ───────────────────────── 3 · "Input" surface (URL/locale params) ─────────────────────────

  test('garbage locale segment (/xx) is normalized, not a hard 500/blank', async ({ page }) => {
    const w = watch(page)
    const resp = await page.goto('/xx')
    await settle(page)
    const status = resp?.status() ?? 0
    const bodyLen = (await page.locator('body').innerText()).trim().length
    test.info().annotations.push({ type: 'observed', description: `/xx → status=${status} bodyLen=${bodyLen} url=${page.url()} 5xx=${w.badResponses.filter(b=>/ 5\d\d /.test(' '+b+' ')).length}` })
    // proxy.ts treats an unknown first segment as a non-locale path and prefixes
    // the default locale → /es/xx, which is a real 404 page (NOT a 5xx/blank).
    const has5xx = w.badResponses.some(b => /^5\d\d /.test(b))
    expect(has5xx, 'unknown locale must not 500').toBeFalsy()
    expect(bodyLen, 'unknown route must still render a real (404) page, not a blank screen').toBeGreaterThan(0)
  })

  test('XSS in the URL hash/query is inert (no script execution, no reflected markup)', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    await page.goto('/es?q=<script>alert(1)</script>#<img src=x onerror=alert(2)>')
    await settle(page)
    expect(dialog, 'no script/onerror execution from URL payloads').toBeFalsy()
    const liveScripts = await page.locator('script:has-text("alert(1)")').count()
    expect(liveScripts, 'injected payload must not become live markup').toBe(0)
    // Page still renders normally.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('oversized junk query string does not break the render', async ({ page }) => {
    const big = 'a'.repeat(6000)
    await page.goto(`/es?spam=${big}`)
    await settle(page)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  // ───────────────────────── 4 · Every internal link resolves (no 404/blank) ─────────────────────────

  test('every internal landing link resolves to a real page (no 404/blank/5xx)', async ({ page, context }) => {
    test.setTimeout(120_000)
    await page.goto('/es')
    await settle(page)

    // Collect unique same-origin/relative hrefs that are real navigations
    // (skip pure in-page anchors, mailto:, tel:, wa.me, and the JS-driven toggle).
    const hrefs = await page.evaluate(() => {
      const out = new Set<string>()
      document.querySelectorAll('a[href]').forEach(a => {
        const h = (a as HTMLAnchorElement).getAttribute('href') || ''
        if (!h) return
        if (h.startsWith('#')) return
        if (/^(mailto:|tel:|https?:\/\/wa\.me)/i.test(h)) return
        // external absolute links (other origins) are validated separately
        out.add(h)
      })
      return [...out]
    })
    test.info().annotations.push({ type: 'observed', description: `internal hrefs discovered: ${hrefs.join(' , ')}` })

    const broken: string[] = []
    const probe = await context.newPage()
    for (const h of hrefs) {
      // Only probe our own origin / relative app routes here.
      if (/^https?:\/\//i.test(h) && !/englishkolab\.com/i.test(h)) continue
      const target = h.replace('#how-it-works', '').replace('#pricing', '').replace('#teachers', '').replace('#faq', '') || '/es'
      try {
        const r = await probe.goto(target, { waitUntil: 'domcontentloaded' })
        const status = r?.status() ?? 0
        const bodyLen = (await probe.locator('body').innerText().catch(() => '')).trim().length
        if (status >= 400 || bodyLen === 0) broken.push(`${h} → status=${status} bodyLen=${bodyLen}`)
      } catch (e) {
        broken.push(`${h} → THREW ${(e as Error).message}`)
      }
    }
    await probe.close()
    expect(broken, `broken internal links:\n${broken.join('\n')}`).toEqual([])
  })

  test('footer Company links (privacy / terms / contact) load real pages', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    const footer = page.locator('footer')
    for (const [label, urlRe] of [
      [COPY.es.footerPrivacy, /\/es\/privacy/],
      [COPY.es.footerTerms, /\/es\/terms/],
      [COPY.es.footerContact, /\/es\/contact/],
    ] as const) {
      await footer.getByRole('link', { name: label, exact: true }).click()
      await settle(page)
      expect(page.url(), `${label} should route to ${urlRe}`).toMatch(urlRe)
      const len = (await page.locator('body').innerText()).trim().length
      expect(len, `${label} page must not be blank`).toBeGreaterThan(50)
      await page.goBack()
      await settle(page)
    }
  })

  test('mailto + WhatsApp support channels carry the correct, valid hrefs', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    // WhatsApp number lives in FAQ (https://wa.me/50488902191); email in FAQ + footer.
    const wa = page.locator('a[href^="https://wa.me/"]').first()
    await expect(wa).toHaveAttribute('href', 'https://wa.me/50488902191')
    const mail = page.locator('a[href^="mailto:"]').first()
    await expect(mail).toHaveAttribute('href', 'mailto:hola@englishkolab.com')
  })

  // ───────────────────────── 5 · CTAs route correctly ─────────────────────────

  test('primary hero CTA routes to /es/registro', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    await page.getByRole('link', { name: COPY.es.heroCtaPrimary, exact: true }).first().click()
    await settle(page)
    await expect(page).toHaveURL(/\/es\/registro/)
    // Content proof we landed on the real registration page, not a blank.
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50)
  })

  test('hero secondary CTA "Ver cómo funciona" scrolls to #how-it-works (no nav away)', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    await page.getByRole('link', { name: COPY.es.heroCtaSecondary, exact: true }).first().click()
    await settle(page, 1200)
    await expect(page.locator('#how-it-works')).toBeInViewport({ ratio: 0.05 })
    expect(page.url(), 'should stay on the landing (in-page anchor)').toMatch(/\/es(#how-it-works)?$/)
  })

  test('FinalCTA discovery ghost CTA carries the ?intent=discovery param to /registro', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    await page.getByRole('link', { name: COPY.es.finalGhost, exact: true }).click()
    await settle(page)
    await expect(page).toHaveURL(/\/es\/registro\?intent=discovery/)
  })

  test('every pricing plan card CTA routes to /es/registro', async ({ page }) => {
    await page.goto('/es#pricing')
    await settle(page)
    // CTA spans read "Elegir <Plan>" (see Pricing.tsx). Confirm 4 plan CTAs link to /registro.
    const planCtas = page.locator('#pricing a[href$="/es/registro"]')
    const count = await planCtas.count()
    test.info().annotations.push({ type: 'observed', description: `pricing plan CTAs → /es/registro = ${count}` })
    expect(count, 'all 4 plan cards must link to /es/registro').toBeGreaterThanOrEqual(4)
  })

  // ───────────────────────── 6 · FAQ accordion ─────────────────────────

  test('FAQ accordion expands/collapses and exposes content', async ({ page }) => {
    await page.goto('/es#faq')
    await settle(page)
    // First trigger (index 0) starts open in the component (useState(0)).
    const t0 = page.locator('#faq-trigger-0')
    await expect(t0).toHaveAttribute('aria-expanded', 'true')

    // A different one starts collapsed; click to expand and reveal its panel.
    const t2 = page.locator('#faq-trigger-2')
    await expect(t2).toHaveAttribute('aria-expanded', 'false')
    await t2.click()
    await settle(page, 800)
    await expect(t2).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#faq-panel-2')).toBeVisible()
    // Click again → collapses.
    await t2.click()
    await settle(page, 800)
    await expect(t2).toHaveAttribute('aria-expanded', 'false')
  })

  // ───────────────────────── 7 · i18n — language toggle + ES/EN parity ─────────────────────────

  test('navbar ES→EN toggle flips the page to English', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    await expect(page.getByText(COPY.es.heroEyebrow, { exact: false }).first()).toBeVisible()
    // The toggle is a button with aria-label "Switch to EN" (from /es).
    await page.getByRole('button', { name: /Switch to EN/i }).click()
    await settle(page, 1500)
    // English content must now render (content proof, not just URL).
    await expect(page.getByText(COPY.en.heroEyebrow, { exact: false }).first()).toBeVisible()
    expect(page.url()).toMatch(/\/en(\/|$|#)/)
  })

  test('language choice persists across navigation via the ee-locale cookie', async ({ page, context }) => {
    await page.goto('/es')
    await settle(page)
    await page.getByRole('button', { name: /Switch to EN/i }).click()
    await settle(page, 1500)
    // Cookie written by handleLocaleSwitch in Navbar.tsx.
    const cookies = await context.cookies()
    const locale = cookies.find(c => c.name === 'ee-locale')?.value
    test.info().annotations.push({ type: 'observed', description: `ee-locale cookie after toggle = ${locale}` })
    expect(locale, 'toggle should persist ee-locale=en').toBe('en')

    // Hitting bare "/" now should land on /en (proxy.ts getLocale reads the cookie).
    await page.goto('/')
    await settle(page)
    await expect(page.getByText(COPY.en.heroEyebrow, { exact: false }).first()).toBeVisible()
    expect(page.url(), 'persisted locale should redirect / → /en').toMatch(/\/en(\/|$|#)/)
  })

  test('EN page contains NO hardcoded Spanish-only nav/footer strings (parity)', async ({ page }) => {
    await page.goto('/en')
    await settle(page)
    const body = (await page.locator('body').innerText())
    // Untranslated leakage: these ES-only labels must NOT appear on the EN page.
    // (Brand tokens like "1 a 1" appear only inside the ES eyebrow, so they're a
    // reliable leak signal too.)
    const leaks: string[] = []
    for (const esOnly of [COPY.es.navHow, COPY.es.navPricing, COPY.es.navFaq, COPY.es.footerTagline, 'Inglés en vivo']) {
      if (body.includes(esOnly)) leaks.push(esOnly)
    }
    test.info().annotations.push({ type: 'observed', description: `ES strings leaked onto /en: ${leaks.join(' | ') || 'none'}` })
    // Note: "Español" legitimately appears in the footer locale switch on BOTH
    // locales, so it is intentionally NOT in the leak list.
    expect(leaks, `Spanish strings hardcoded on the English page:\n${leaks.join('\n')}`).toEqual([])
  })

  test('ES page contains NO hardcoded English-only nav strings (parity)', async ({ page }) => {
    await page.goto('/es')
    await settle(page)
    const headerText = await page.locator('header').innerText()
    const leaks: string[] = []
    // The header nav on /es must be Spanish. EN-only nav labels here = a leak.
    // ("How it works"/"Pricing"/"Questions" are EN; the ES header uses the
    // Spanish ones.)
    for (const enOnly of ['How it works', 'Pricing', 'Questions']) {
      if (headerText.includes(enOnly)) leaks.push(enOnly)
    }
    test.info().annotations.push({ type: 'observed', description: `EN nav strings leaked onto /es header: ${leaks.join(' | ') || 'none'}` })
    expect(leaks, `English nav strings hardcoded on the Spanish header:\n${leaks.join('\n')}`).toEqual([])
  })

  test('document <html lang> matches the active locale on each page', async ({ page }) => {
    for (const lang of ['es', 'en'] as const) {
      await page.goto(`/${lang}`)
      await settle(page)
      const htmlLang = await page.locator('html').getAttribute('lang')
      test.info().annotations.push({ type: 'observed', description: `/${lang} → <html lang="${htmlLang}">` })
      // Root layout hardcodes lang="es"; flag if /en does not update it (a11y/SEO finding).
      expect(htmlLang, `<html lang> on /${lang} should be "${lang}"`).toBe(lang)
    }
  })

  // ───────────────────────── 8 · CONFIDENTIALITY — never expose a teacher roster/count ─────────────────────────

  test('CONFIDENTIALITY — landing never advertises a teacher roster or "N teachers" count', async ({ page }) => {
    const offenders: string[] = []
    for (const lang of ['es', 'en'] as const) {
      await page.goto(`/${lang}`)
      await settle(page)
      const body = await page.locator('body').innerText()
      // Any "<number> maestros/profesores/teachers/tutors" phrasing breaks the
      // ONE-teacher confidentiality rule (product sells a 1-to-1 experience).
      // Word-boundary + plural noun; "1 a 1" / "1 to 1" / single-teacher copy is fine.
      const rosterRe = /\b(\d{1,5})\s*\+?\s*(maestros|profesores|tutores|teachers|tutors|instructors)\b/gi
      let m: RegExpExecArray | null
      while ((m = rosterRe.exec(body)) !== null) {
        // "1 maestro"/"1 teacher" (singular intent) is allowed; only counts ≥2 or a "+" suffix leak a roster.
        const n = parseInt(m[1], 10)
        if (n >= 2 || /\+/.test(m[0])) offenders.push(`/${lang}: "${m[0].trim()}"`)
      }
      // Also flag "choose/elige (from) ... teachers/maestros" marketplace framing.
      if (/\b(elige|escoge|browse|choose from)\b[^.]{0,40}\b(maestros|teachers|profiles|perfiles)\b/i.test(body)) {
        // The Teachers section explicitly says "No eliges entre cien perfiles" /
        // "You don't browse a hundred profiles" — that's the ANTI-marketplace
        // message (negated). Only flag if NOT preceded by a negation.
        const negated = /\b(no|don'?t|not)\b[^.]{0,30}\b(eliges|browse|choose)\b/i.test(body)
        if (!negated) offenders.push(`/${lang}: marketplace "choose from N teachers" framing`)
      }
    }
    test.info().annotations.push({ type: 'CONFIDENTIALITY', description: `teacher-roster leaks: ${offenders.join(' ; ') || 'none'}` })
    expect(offenders, `CONFIDENTIALITY VIOLATION — landing exposes a teacher roster/count:\n${offenders.join('\n')}`).toEqual([])
  })

  // ───────────────────────── 9 · Responsive ─────────────────────────

  test('mobile 375px — hamburger opens the menu and its anchors/CTA are usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es')
    await settle(page)
    // Hero H1 must be visible and not overflow horizontally.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `375px horizontal overflow px = ${overflow}` })
    expect(overflow, 'no horizontal scroll at 375px').toBeLessThanOrEqual(2)

    // Open the mobile menu (button aria-label="Toggle menu").
    await page.getByRole('button', { name: /Toggle menu/i }).click()
    await settle(page, 600)
    // The portaled sheet exposes nav anchors + the primary CTA "Empezar".
    const sheetCta = page.getByRole('link', { name: COPY.es.navCta, exact: true }).last()
    await expect(sheetCta).toBeVisible()
    await expect(sheetCta).toHaveAttribute('href', /\/es\/registro/)
    await page.screenshot({ path: 'test-results/exhaustive-landing-mobile-menu.png', fullPage: true })
  })

  test('mobile 375px — pricing cards stack and CTAs stay reachable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es#pricing')
    await settle(page)
    await expect(page.locator('#pricing')).toBeVisible()
    const planCtas = page.locator('#pricing a[href$="/es/registro"]')
    await expect(planCtas.first()).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-landing-mobile-pricing.png', fullPage: true })
  })

  // ───────────────────────── 10 · Console errors + network 4xx/5xx ─────────────────────────

  for (const lang of ['es', 'en'] as const) {
    test(`no console errors or own-origin 4xx/5xx while loading /${lang}`, async ({ page }) => {
      const w = watch(page)
      await page.goto(`/${lang}`)
      await settle(page, 3000)
      // Scroll the full page to trigger any lazy assets / whileInView fetches.
      await page.evaluate(async () => {
        await new Promise<void>(res => {
          let y = 0
          const step = () => {
            window.scrollTo(0, y)
            y += 800
            if (y < document.body.scrollHeight) requestAnimationFrame(step)
            else res()
          }
          step()
        })
      })
      await settle(page, 1500)

      test.info().annotations.push({ type: 'observed', description: `/${lang} consoleErrors=[${w.consoleErrors.join(' || ')}]` })
      test.info().annotations.push({ type: 'observed', description: `/${lang} bad responses=[${w.badResponses.join(' || ')}]` })

      // Own-origin 4xx/5xx on a public marketing page is a real finding (broken
      // image, missing /landing/*.jpg, failing FX endpoint, etc.).
      expect(w.badResponses, `own-origin 4xx/5xx on /${lang}:\n${w.badResponses.join('\n')}`).toEqual([])
      expect(w.pageErrors, `uncaught errors on /${lang}:\n${w.pageErrors.join('\n')}`).toEqual([])
      // Console errors recorded as a finding (assert clean; many are real bugs).
      expect(w.consoleErrors, `console errors on /${lang}:\n${w.consoleErrors.join('\n')}`).toEqual([])
    })
  }

  test('all hero/section background images actually load (no broken /landing/*.jpg)', async ({ page }) => {
    const failed: string[] = []
    page.on('response', r => {
      if (/\/landing\/.+\.(jpg|jpeg|png|webp|avif)/i.test(r.url()) && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`)
      }
    })
    await page.goto('/es')
    await settle(page, 2500)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await settle(page, 1500)
    test.info().annotations.push({ type: 'observed', description: `landing image failures: ${failed.join(' | ') || 'none'}` })
    expect(failed, `broken landing background images:\n${failed.join('\n')}`).toEqual([])
  })

  // ───────────────────────── State / concurrency ─────────────────────────

  test('two-tab locale isolation — toggling EN in one tab does not retro-flip an already-open ES tab', async ({ browser }) => {
    const ctx = await browser.newContext()
    const a = await ctx.newPage()
    const b = await ctx.newPage()
    await a.goto('/es'); await settle(a)
    await b.goto('/es'); await settle(b)
    // Toggle tab B to EN (writes the shared cookie).
    await b.getByRole('button', { name: /Switch to EN/i }).click()
    await settle(b, 1500)
    await expect(b.getByText(COPY.en.heroEyebrow, { exact: false }).first()).toBeVisible()
    // Tab A, already rendered, must still be showing Spanish content (no live retro-flip).
    await expect(a.getByText(COPY.es.heroEyebrow, { exact: false }).first()).toBeVisible()
    await ctx.close()
  })
})
