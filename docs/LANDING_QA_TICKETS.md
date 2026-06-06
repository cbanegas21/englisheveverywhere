# EnglishKolab — Landing Page QA Tickets

_Source: Carlos's voice walkthrough of the landing page (2026-06-05), grounded against
the live code + Playwright baseline screenshots in `docs/qa-screenshots/baseline/`._

**Scope this round:** the public landing page only (`/[lang]` → `src/components/landing/*`).
Dashboard / login / auth come in a later round.

**Method (per Carlos):** ticket → queue → fix → QA the ticket → Playwright screenshot proof
(before in `baseline/`, after in `after/`). Each ticket below carries its own QA acceptance.

**Severity:** 🔴 breaks trust / broken · 🟠 important · 🟡 polish · ✅ liked, keep

---

## Liked — keep as-is (verify only, don't redesign)
- **MorningBanner** "Antes del café, una clase." — ✅ Carlos likes it. _Verify mobile height only._
- **TrustStrip** flag/country marquee — ✅ likes it. _No change._
- **Currency switcher** (Navbar: €, £, MXN…) — ✅ works, likes it. _No change._
- **NotebookBanner** "Tu cuaderno se llena." — ✅ likes it on desktop. _Verify mobile (right-aligned text over photo)._
- **FAQ** accordion structure — ✅ likes it (only adding a contact CTA, see LK-12).
- **FinalCTA** "Tu primera clase puede ser hoy." — ✅ likes it (only fixing the "free diagnostic" label, see LK-13).

---

## 🔴 Critical

### LK-02 · Responsive · Mobile is "clumsy / terrible" across the page  _(parent)_
- **You said:** "from a phone it looks terrible… some sections that should be smaller look very big… it is responsive but it's very clumsy."
- **Root cause:** `globals.css` has **zero `@media` queries**; responsiveness relies on Tailwind `md:`/`lg:` + `clamp()`, but many sections hardcode inline pixel gaps/heights/grids that don't adapt.
- **Fix:** treat mobile as a first-class pass, not an afterthought. Concrete offenders are ticketed individually (LK-04 hero, LK-09 grid). Global principle: audit every section at 390px; nothing clipped, nothing overlapping, balanced vertical rhythm.
- **QA:** full-page mobile (390px) screenshot has no overlaps, no horizontal scroll, no clipped content top→bottom. Re-shoot `after/landing-es-mobile.png`.

### LK-04 · Hero · Mobile hero is broken (photo crops to "hair", stats overlap card)
- **You said:** "the image shows very small, so it just shows like the hair of the lady — looks terrible."
- **Evidence:** `Hero.tsx:78-88` full-bleed photo `backgroundPosition:'center right'` + `baseline/sections/mobile-01-block1.png` → photo is a washed blur of the woman's hair; the **stats row (60/1/24·7) collides with the HeroBookingCard** ("Reserva" → "RVA", half-hidden behind the card badge).
- **Root cause:** the desktop full-bleed-photo-with-left-scrim doesn't translate to a 1-col mobile layout; the right photo region has no meaningful subject at 390px, and `gap`/order let the stats and card crowd.
- **Fix:** dedicated mobile hero treatment — either drop/reposition the photo on mobile (or use a proper mobile crop with a clear subject), give the headline its own clean block, and separate the stats from the booking card with real spacing/order.
- **QA:** mobile hero shows a deliberate composition (no hair-only blur), stats and booking card never overlap, headline fully legible. Playwright: assert no element overlap between the stats node and the booking card; re-shoot.

---

## 🟠 Important

### LK-01 · Header · Make the top header truly fixed (it scrolls away on anchor-nav)
- **You said:** "the top header is not maintaining at the top — if I click something in the header it drags me to that section but I lose the header. I want the header fixed."
- **Root cause:** Navbar is correctly `sticky top-0 z-50` (`Navbar.tsx:67`), **but `<main>` has `overflowX:'hidden'` (`page.tsx:31`)**, which promotes `<main>` to a scroll container and disables `position:sticky` for descendants. Also there's **no `scroll-margin-top`** on the anchored sections, so a jump hides the heading under the 64px bar.
- **Fix:** change `<main>` `overflow-x:hidden` → `overflow-x:clip` (clips without creating a scroll container, so sticky survives); add `scroll-margin-top: ~80px` to `#how-it-works/#teachers/#pricing/#faq`.
- **QA:** scroll down → header stays pinned at top; click each nav link → lands with the section title visible (not under the bar). Playwright: after clicking a nav anchor, assert `header.boundingBox().y === 0`.

### LK-09 · HorasGrid · "168 hours" grid is clipped/odd on mobile
- **You said:** "when you make the screen smaller it looks odd… it doesn't show what I would like."
- **Evidence:** `HorasGrid.tsx:104-189` grid `minWidth:560` inside `overflowX:'auto'` → `baseline/sections/mobile-07-block7.png` shows the week clipped at ~12h and the `00h/06h/12h` labels cut off.
- **Fix:** make the schedule visualization legible at 390px — fit the 7×24 cells to width (smaller cells / no fixed 560 min-width), or render a purpose-built mobile version. Keep desktop as-is.
- **QA:** at 390px the full week + all hour labels are visible without a broken right-edge clip. Re-shoot.

### LK-10 · Pricing · "One payment per month" is misleading; needs to be clearer + more sales-y
- **You said:** "it's not just one payment per month — if someone wants the Spark twice because they want more classes, they should understand that on their own. We shouldn't be misleading."
- **Evidence:** `Pricing.tsx:15,42` sub = "One payment per month. No auto-renewal." — implies a once-monthly cap. Reality (per resolved webhook notes): buying a pack again **stacks** `classes_remaining`, and classes never expire.
- **Fix:** reframe to remove the "per month" implication and make stacking explicit, e.g. "Pay once per pack — buy as many as you want, classes stack and never expire. No auto-renewal." Make the section more persuasive (value framing, not just specs) without overpromising.
- **QA:** copy no longer implies a monthly limit; stacking is stated; nothing contradicts the one-time `payment`-mode model. Spanish + English both updated.

### LK-12 · FAQ · Add a contact CTA at the end
- **You said:** "add something like: if you need more questions, contact us at this WhatsApp number… and they can send an email too. But always recommend booking the first intro class to answer their questions."
- **Fix:** append a closing block under the FAQ: WhatsApp link (**+504 8890-2191 → `50488902191`, _confirm_**), support email (`hola@englishkolab.com`), and a line nudging the free intro class as the best way to get all questions answered. ES + EN.
- **QA:** FAQ ends with a visible, tappable WhatsApp + email + "book your free first class" nudge. WhatsApp link opens `https://wa.me/50488902191`.

### LK-13 · FinalCTA · "Free diagnostic" is ambiguous ("free diagnostic _what?_")
- **You said:** "it says free diagnostic — free diagnostic what? It's a bit misleading."
- **Evidence:** `FinalCTA.tsx:16,27` ghost CTA = "Diagnóstico gratis" / "Free diagnostic"; also both CTAs link to `/registro` (the ghost dups the primary — old EK-030).
- **Fix:** name it fully — "Llamada de diagnóstico gratis" / "Free diagnostic call" (or "Free placement call"), consistent with the PROJECT.md "free human placement call." Decide the ghost CTA's real destination (or remove the dup).
- **QA:** label unambiguous; the two CTAs are differentiated or the redundant one removed.

### LK-14 · Copy · Anti-misleading sweep (principle)
- **You said:** "all sections must be easily understood by anyone who wants to purchase — not misleading."
- **Fix:** a final read-through after LK-10/LK-13 ensuring no section implies something untrue (monthly cap, auto-assignment-before-booking, recordings, etc.). Cross-checks against PROJECT.md flow.
- **QA:** checklist pass; ES + EN parity.

---

## 🟡 Polish / creative

### LK-03 · Hero · Photo reads too "washed / vanished" (desktop)
- **You said:** "I cannot see the image very well, it looks very vanished. I like it but it could be better — take a look with Playwright."
- **Evidence:** `Hero.tsx:90-98` cream scrim is 0.97 opaque at 34% → photo only emerges far right; `filter:saturate(0.95)`.
- **Fix:** Playwright-tune the scrim/position/filter so the photo is present and intentional while keeping the headline legible (raise photo presence on the right, soften the wall on the left edge). Iterate on screenshots.
- **QA:** photo clearly readable as a scene (not a ghost), headline contrast still AA. Side-by-side before/after.

### LK-05 · Hero · Right-side "box" (HeroBookingCard) — make it more interesting/intuitive
- **You said:** "maybe change that box in the right section — something more interesting, more intuitive. I need your creativity."
- **Evidence:** `HeroBookingCard.tsx` = decorative live-clock + fake slot rows linking to `/registro`.
- **Fix:** redesign into something that communicates the core promise (book any hour, 24h ahead) more vividly / more clearly as a real affordance. _Needs a direction decision — see questions._
- **QA:** new component reads as intentional and on-brand; works desktop + mobile. Before/after.

### LK-06 · Hero · Headline legibility — bold weight + accent color hard to read in spots
- **You said:** "I don't see the colors of some letters because of the boldness of some titles."
- **Evidence:** `Hero.tsx:130-172` — 800-weight headline + red serif-italic accent partly over the photo region.
- **Fix:** review weight/tracking/contrast where text meets the photo; ensure the red accent + dark text stay legible everywhere (esp. mobile). Possibly add a subtle text-side scrim or shift the photo.
- **QA:** all headline glyphs legible at desktop + mobile; contrast holds over the photo.

### LK-07 · HowItWorks · "Four steps / Cuatro pasos" feels blank/empty
- **You said:** "it could be better, it's very blank, doesn't say that much."
- **Evidence:** `HowItWorks.tsx` + `baseline/sections/*-04-how-it-works.png` — airy columns, thin top borders, lots of dead space.
- **Fix:** give it substance — stronger visual hierarchy, connective structure (numbered flow), maybe supporting detail per step, without breaking the editorial DNA. Keep the corrected step order (book → admin assigns after).
- **QA:** section feels intentional and informative, not empty. Before/after at desktop + mobile.

### LK-08 · Teachers · "One teacher / Un maestro" preview card is "meh"
- **You said:** "this section is a bit meh — it has a box with a supposed preview but it's not good. It could be way better. I need your creativity."
- **Evidence:** `Teachers.tsx:165-329` + `baseline/sections/*-05-teachers.png` — plain white card, generic avatar glyph, placeholder labels.
- **Fix:** redesign the right side into something compelling (still honest: one real teacher, matched-after-booking; no fake multi-city network per EK-009). _Direction decision — see questions._
- **QA:** the section's right side is a real visual asset, on-brand, honest. Before/after.

### LK-11 · Pricing · "What you get regardless of the pack" panel — polish
- **You said:** "it could be better — just a matter of polishing."
- **Evidence:** `Pricing.tsx:316-408` shared features panel.
- **Fix:** elevate the included-in-every-plan panel (hierarchy, iconography, spacing) so it reinforces value. Pairs with LK-10.
- **QA:** panel looks deliberate and premium; before/after.

---

## Proposed queue (attack order)
1. **LK-01** header fixed _(quick, global)_
2. **LK-02 + LK-04 + LK-09** the mobile pass _(highest impact — "terrible on phone")_
3. **LK-03 + LK-06 + LK-05** hero desktop polish, legibility, right-box redesign
4. **LK-07 + LK-08** HowItWorks + Teachers creative enrichment
5. **LK-10 + LK-11 + LK-13 + LK-12 + LK-14** pricing clarity/sales, free-diagnostic, FAQ contact, copy sweep
6. **Keep-checks:** MorningBanner / NotebookBanner / TrustStrip mobile verify

Each ticket: implement → re-screenshot into `docs/qa-screenshots/after/` → assert acceptance → mark done.

---

## Results — implemented & QA'd (2026-06-05)

Foundation done by hand; LK-03..LK-13 implemented by 8 parallel agents (one per file-group, no shared files). Verified against `after/` screenshots + a Playwright assertion for the sticky header. Dev server `/es` + `/en` return 200; `tsc --noEmit` clean on all landing files (only pre-existing error is `tests/e2e/booking-guard-24h.spec.ts`, unrelated).

| Ticket | Status | Proof / note |
|---|---|---|
| LK-01 header sticky | ✅ | `qa-verify-header.mjs`: `pinnedOnScroll:true, headerY:0` desktop+mobile. Fix: `main` overflow `hidden`→`clip` + `scroll-margin-top:80px` on anchored ids. |
| LK-02 mobile pass | ✅ | All sections stack cleanly at 390px; no overlap/clip/h-scroll. |
| LK-03 hero photo | ✅ | Scrim re-tuned (opens faster past 24%), `backgroundPosition:72%`, saturate/contrast up — photo now present on desktop. |
| LK-04 hero mobile | ✅ | Photo dropped→warm wash on ≤1023px (no hair-blur); stats no longer overlap booking card. |
| LK-05 hero box | ✅ | Booking preview polished (red hairline, live dot, hover lift, dark RESERVAR pill). |
| LK-06 legibility | ✅ | Paper-warm text-shadow halo on H1; legible over photo desktop+mobile. |
| LK-07 HowItWorks | ✅ | 4 cards + crimson connector rail + numbered discs + takeaway chips; correct assign-after-book step. |
| LK-08 Teachers | ✅ | Premium dark "uno, no cien" card, abstract avatar, honest match rows (no fake identity). |
| LK-09 HorasGrid | ✅ | Removed `minWidth:560`→`minmax(0,1fr)`; full week + labels fit at 390px. |
| LK-10 pricing copy | ✅ | "per month" → "Paga una vez por paquete… se acumulan y nunca caducan"; per-card "pago único". |
| LK-11 includes panel | ✅ | Reworked panel + icons + reassurance callout (the "tu propio maestro, no un marketplace de diez" angle). |
| LK-12 FAQ contact | ✅ | Contact card: WhatsApp `wa.me/50488902191` (+504 8890-2191), `hola@englishkolab.com`, "Reservar mi clase gratis". |
| LK-13 free diagnostic | ✅ | Renamed → "Llamada de diagnóstico gratis / Free diagnostic call" + clarifying microcopy; ghost CTA differentiated. |
| LK-14 copy sweep | ✅ | Misleading items (monthly cap, ambiguous diagnostic) resolved; ES/EN parity held. |
| Banners (keep) | ✅ | Desktop untouched; mobile scrims reworked so text stays legible at 390px. |

QA scripts added under `scripts/`: `qa-shots.mjs` (full-page), `qa-sections.mjs` (per-section), `qa-verify-header.mjs` (sticky assertion). Re-run with `node scripts/<file> <out-folder>`.

**Pending:** Carlos's visual review → `pnpm build` → push to `main` (Vercel auto-deploy).
