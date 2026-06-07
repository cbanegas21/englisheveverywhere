# ST-14 — Cheap-icon audit + replacement proposal (student surfaces)

**Status: PROPOSAL — awaiting Carlos's direction pick. NOT built.** Produced by an audit workflow 2026-06-06. Only the FOUR student surfaces in scope were audited (My Classes, My Plan, My Progress, Agendar/Placement, Homework/Library/Join).

## Inventory — where the cheap icons actually are
- **My Classes (`clases/ClasesClient.tsx`): 3 cheap**
  - `Stethoscope` on the "Diagnostic call" label (**line 774**) — Carlos's #1 offender. The row already shows a real StatusBadge, so the icon is pure decoration.
  - `FileText` on the **Teacher notes** header (line 1067) and **Transcript** header (line 1088) — each sits directly left of an already-existing mono uppercase kicker (redundant).
- **My Plan (`plan/PlanClient.tsx`): 1 cheap**
  - `CheckCircle2` (line 312) inside a 64×64 tinted circle in the purchase-success modal — the textbook "success celebration" tile. `CreditCard` in Pay-now (985) is borderline (not counted).
- **My Progress, Agendar, Placement, Homework/Library/Join: CLEAN** — only functional/semantic icons (chevrons, search, accordion, CTA checkmarks, calendar/clock/download affordances).

## Direction options
- **A) Typography-first removal — RECOMMENDED.** Delete the 4 cheap icons; lean on the shipped de-AI system. The two `FileText` cases are one-line deletions (the mono kicker already sits beside them). `Stethoscope` row already has a StatusBadge. Plan modal → a typographic success beat (serif title + mono kicker, e.g. "PAGO CONFIRMADO"). Lowest effort/risk, perfectly consistent, honors "be selective / don't over-iconify."
- **B) Tiny custom EK mark family.** Bespoke SVG mark(s) only for the diagnostic call (a recurring product moment across My Classes + Placement + Progress) and/or the success modal. Brand equity, but real design cost + scope-creep risk. Use only if Carlos wants the diagnostic call to have its own identity.
- **C) Refined minimal subset.** Remove cheap, keep the borderline-functional ones (kebab menu, CTAs) normalized to one weight. Softer than the bar Carlos usually picks — not recommended.

## Recommendation
**Direction A by default**, with ONE Carlos decision: does the **diagnostic call** get a single custom mark (a B carve-out used consistently across My Classes + Placement + Progress), or stay text-only?

## Per-surface mapping
| Surface | Current | Proposed |
|---|---|---|
| My Classes — Diagnostic call (line 774) | Stethoscope beside label (row already has a StatusBadge) | Remove. Text + existing badge. Optional: tiny "Diagnóstico" kicker, or a custom mark only if Direction B is approved. |
| My Classes — Teacher notes header (1067) | FileText left of mono kicker | Delete icon (one-line). Kicker stands alone. |
| My Classes — Transcript header (1088) | FileText left of mono kicker | Delete icon. Optional hairline rule above. |
| My Plan — success modal (312) | CheckCircle2 in tinted circle tile | Replace tile with typographic success beat: serif title (already present) + mono kicker; if a glyph is wanted, a thin inline checkmark/hairline, not a circle. |
| My Plan — Pay-now button (985) | CreditCard in button | Selective: recommend remove for clean text CTA; low-stakes, leave if Carlos prefers the affordance. |
| My Classes — kebab menu (879/901/924) | CalendarClock / XCircle / AlertOctagon | Borderline, not in cheap-scope. Leave as quiet affordance OR strip to hairline + semantic color. Defer to Carlos. |

## Open questions for Carlos (decide before building)
1. **Diagnostic call mark:** custom EK mark (Direction B) vs plain text + StatusBadge? (biggest fork)
2. **Purchase-success modal:** pure typographic vs keep some visual beat (thin checkmark/hairline)?
3. **Borderline functional icons** (kebab menu, CreditCard, Video in Join): keep as a quiet affordance layer or strip to text? (rec: keep menu + Join, optionally drop CreditCard)
4. **If Direction B:** who draws the marks (Carlos / designer / me drafting SVGs for approval), cap at 1–2.
5. **Scope:** ST-14 student-only, or extend the icon de-AI pass to teacher (`/maestro/*`) + admin this round?
