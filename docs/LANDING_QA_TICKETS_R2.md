# EnglishKolab — Landing QA Round 2 (discrepancy audit)

_Source: Carlos's deeper feedback (2026-06-05) + a 7-agent read-only audit across 390/768/1024/1440 and both locales. Evidence in `docs/qa-screenshots/{audit,round2,after,diagnose}/`._

**Governing principle:** kill the "AI-generated website" look — no generic icons, glyph tiles, or template widgets. Typography-first editorial (serif/mono numerals, hairline rules, restraint, intentional space). Everything intentionally placed; consistent across sections. See memory `englishkolab-design-no-generic-ai`.

**Locked decisions (Carlos):** tighten hero top space · mobile menu → overlay/drawer (no reflow) · strip generic icons → pure typography · FAQ contact block → left column.

Severity: 🔴 high · 🟠 medium · ⚪ low. `★` = AI-tell.

---

## A. Remove the "AI look" → typography-first
- **LK2-01 🔴★ HowItWorks step icons** — remove the line-icon-in-tinted-plate per step; let a large serif/mono numeral (01–04) anchor each card. (`HowItWorks.tsx:75-97,307-323`)
- **LK2-02 🔴★ Pricing "every pack includes" glyph tiles** (◷✶∞⟳ in red squares + hover-fill) — remove; hairline-ruled typographic list (mono index + label + soft sub). (`Pricing.tsx:28-31,359-378,448-453`)
- **LK2-03 🔴★ Teachers avatar** (gradient orb + dashed ring + person icon) — remove; lead with the serif "uno, no cien." lockup; either commit the ghost "1" (bring on-canvas, ~0.09 opacity, legible) or cut it. (`Teachers.tsx:196-214,280-319`)
- **LK2-04 🟠★ Hero/booking card decorations** — drop the red `✓` value-line glyph, the `↳` card arrow, and the **fake equalizer bar-chart**; soften the booking card from "SaaS widget" (drop 3px red gradient top-bar, lighten shadow). (`Hero.tsx:265-270`, `HeroBookingCard.tsx:82-88,183-195,213`)
- **LK2-05 🟠★ HorasGrid decorations** — drop `↳` label arrows; keep ONE hour scale (not two); make "03:24 / Hora local" a live ticking clock or drop the "local" framing. (`HorasGrid.tsx:13,15,23,174,197-203`)
- **LK2-06 🟠★ Kicker double-dot (systemic)** — strip the literal `●`/`★` baked into eyebrow strings; rely on the single `.ek-kicker::before` dot everywhere; remove `--no-dot` hacks. (all sections; `globals.css:183-191`)
- **LK2-07 🟠★ Pricing reassurance widget** — drop the red vertical-bar "quote" treatment → serif-italic footnote under one hairline. (`Pricing.tsx:379-394`)
- **LK2-08 ⚪★ Footer** — replace the orphan "Idioma" column (dup of header switch) with real editorial weight or collapse to 3-col + language in the bottom bar; CSS `:hover/:focus-visible` instead of inline JS. (`Footer.tsx:85,131-137`)

## B. Responsive / the tablet zone (768–1024, never tested before)
- **LK2-09 🔴 Navbar clips the CTA at 768–1023** — full desktop nav shows at `md` but doesn't fit; the "Empezar" pill is cut off. Raise the threshold to `lg` (1024) so the tablet band uses the clean menu. (`Navbar.tsx:79,107`)
- **LK2-10 🔴 Mobile menu → overlay/drawer** — fixed, full-height, scrim, body-scroll-lock; page underneath never reflows. (`Navbar.tsx:191-306`)
- **LK2-11 🔴 HowItWorks 1-col until 880** — add a 2×2 tablet tier; recompute/drop the connector for 2-col. (`HowItWorks.tsx:112-147`)
- **LK2-12 🔴 Pricing 3+1 orphan** — replace `auto-fit` with explicit 1 / 2×2 / 4-up; "Cima" never lonely. (`Pricing.tsx:153-159`)
- **LK2-13 🔴 HorasGrid tablet** — at 768 the clock photo becomes a giant banner + grid stretches; add md 2-col / cap width. Mobile labels at 7.5px are illegible → coarser grid (e.g. 3-hour blocks) or drop numeric labels. (`HorasGrid.tsx:100-106,158`)
- **LK2-14 🟠 Hero stacked card over-wide at 768–1023** — cap the booking card max-width (~520px) when stacked. (`Hero.tsx:150`)
- **LK2-15 🟠 Teachers card float** — `alignSelf:start` so card top-aligns with the headline; add md 2-col / cap width at 768. (`Teachers.tsx:83,191`)
- **LK2-16 🟠 Banners** — unify Morning/Notebook heights (360 vs 320); strengthen scrim so text clears the bright photo zone at 768/1024. (`MorningBanner.tsx:25`, `NotebookBanner.tsx:24`)
- **LK2-17 🟠 FAQ email truncation** — `hola@englishkolab.com` ellipsis-clips in the narrow column; full address must always show (eased by LK2-23). (`FAQ.tsx:316-373`)

## C. Layout & alignment consistency (root of "clunky")
- **LK2-18 🔴 Shared shell inset** — Hero hardcodes 24px gutter while sections use `clamp(24px,6vw,80px)`, so left edges don't line up. One shell (`max-w-7xl` + clamp gutter) for Navbar + Hero + all sections. (`Hero.tsx:147` vs others)
- **LK2-19 🔴 Section vertical-rhythm token** — HorasGrid 120/64, FinalCTA 140, others 96 → one symmetric scale token; reserve larger only for the closing CTA. (`HorasGrid.tsx:52`, `FinalCTA.tsx:42`)
- **LK2-20 🟠 Hero top padding** — tighten the dead band under the nav. (`Hero.tsx:147`)
- **LK2-21 🟠 One card radius** — 4px (Pricing/HorasGrid) vs 14px (most) vs broken `--ek-radius-md,16px` fallback (token is 8px). Pick one; fix the fallback. (`globals.css:69`, multiple)
- **LK2-22 🟠 Background cadence** — HorasGrid + Pricing are both warm and adjacent; enforce paper/paper-warm alternation so sections separate by tone, not a hairline. (`HorasGrid.tsx:51`, `Pricing.tsx:89`)
- **LK2-23 🔴 FAQ contact → left column** — move the "Talk to a real person" block into the empty left column under the heading; `position:sticky` so it stays as you scroll the accordion. (`FAQ.tsx:78,192-309`)
- **LK2-24 🟠 Hero line-3 hierarchy + measure** — "Literalmente cuando quieras." is the SAME size as section H2s; demote it, and cap the headline measure so it never crosses into the thin-scrim photo zone. (`Hero.tsx:200-209,92-104`)

## D. Type & component system
- **LK2-25 🟠 Body tokens** — paragraphs range 14.5–18px ad-hoc (Teachers stacks 17 then 15); route through `.ek-body`/`.ek-body-large`; kill fractional sizes. (multiple; `globals.css:235-250`)
- **LK2-26 ⚪ Mono-label tokens** — kicker letter-spacing varies 0.08/0.1/0.12/0.18em; define one "kicker" + one "micro-label" token. (multiple)
- **LK2-27 🟠 Button system** — `.ek-btn` vs legacy `.ee-btn*` vs inline-styled pills coexist (radius 999 vs 4, different padding). Consolidate on `.ek-btn` + a size modifier; rebuild the Pricing card CTA from it. (`globals.css:266-318,400-427`, `Pricing.tsx:304-319`)

## E. Smaller polish
- **LK2-28 🟠 TrustStrip marquee** — `paddingLeft:40` breaks the `-50%` loop (visible stutter); add an edge-mask fade so flags don't slice mid-word; remove the no-op same-color border. (`TrustStrip.tsx:38-52`)
- **LK2-29 ⚪ FinalCTA** — drop the forced `<br/>`; responsive vertical padding; balance the logged-in single-CTA row. (`FinalCTA.tsx:42,113-115`)
- **LK2-30 ⚪ HorasGrid axis** — align ticks to real column edges; fix the dangling "24h"; add a tiny "reservado/free" legend so the grid reads as data. (`HorasGrid.tsx:66,87,172,197-203`)
- **LK2-31 ⚪ EN copy balance** — longer EN strings (HowItWorks step 4, Pricing labels) make cards uneven at 4-up; reserve title min-height / tighten EN copy.

---

## Suggested execution order
1. **Foundation tokens** (unblocks the rest): shared shell inset (LK2-18), section-rhythm token (LK2-19), card radius (LK2-21), kicker dot (LK2-06), button consolidation (LK2-27), body tokens (LK2-25).
2. **Navbar + mobile drawer** (LK2-09, LK2-10) + hero (LK2-20, LK2-24, LK2-04, LK2-14).
3. **De-AI the sections**: HowItWorks (LK2-01, LK2-11), Pricing (LK2-02, LK2-07, LK2-12), Teachers (LK2-03, LK2-15), HorasGrid (LK2-05, LK2-13, LK2-30), FAQ (LK2-23, LK2-17).
4. **Banners/strip/CTA/footer** (LK2-16, LK2-08, LK2-22, LK2-28, LK2-29) + EN balance (LK2-31) + label tokens (LK2-26).
Each ticket: implement → re-screenshot (390/768/1024/1440) → verify → mark done.

---

## Results — implemented & QA'd (2026-06-05)

**Phase 1 (foundation + structure)** — `globals.css` tokens by hand; 9-agent workflow applied them. ✅ All:
- `.lk-shell` (one inset → left edges align), `--ek-section-y` (one rhythm), one card radius, single `.ek-kicker` dot, `.ek-btn--lg`, `.ek-body` tokens.
- Navbar `md→lg` (CTA no longer clips at 768–1023) + **mobile menu rebuilt as a fixed overlay drawer portaled to `<body>`** (escapes the header's `backdrop-filter`; page dims, doesn't reflow; X stays clickable — hand-fixed after the workflow).
- Hero top tightened (kicker up ~40px) + line-3 demoted/measure-capped; FAQ contact → left sticky column; Pricing 2×2/4-up; Teachers top-align; banner heights unified; tone cadence.

**Phase 2 (de-AI, typography-first)** — 7-agent workflow. ✅ All:
- **HowItWorks**: step icons + plates + double-counter + connector rails → big red serif numerals 01–04 on a hairline ledger; 2×2 tablet.
- **Pricing**: `◷✶∞⟳` glyph tiles → hairline-ruled list w/ mono index numerals; red-bar quote → serif footnote; `★` → mono tag; price hierarchy raised.
- **Teachers**: avatar orb + dashed ring + person icon → "Tu maestro / *uno, no cien*" serif lockup + committed ghost "1" watermark + hairline rows.
- **Hero card**: fake equalizer chart + `↳` + red gradient bar + heavy shadow → quiet mono cue + softened printed-schedule card; value-line `✓` → red hairline.
- **HorasGrid**: `↳` arrows + double hour-scale + fake "03:24" → one column-aligned axis + **live local clock** + "■ reservado" legend; tablet 2-col, legible mobile grid.
- **FAQ**: icon-circle channels → editorial mono-label rows.
- **TrustStrip/Footer/FinalCTA**: seamless marquee + edge fade + no-op border removed; footer orphan column → email + manifesto, language to bottom bar; forced `<br>` dropped + logged-in CTA balanced.

**Health:** `tsc` clean · `/es`+`/en` 200 · zero horizontal overflow · ES/EN parity. Proof: `docs/qa-screenshots/{r2-phase1,r2-phase2}/`.

**Pending:** Carlos's review → `pnpm build` → push to `main`.
