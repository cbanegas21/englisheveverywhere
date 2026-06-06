# Teacher-side QA backlog — Carlos walkthrough 2026-06-06 (Round 2)

Status: **PLANNING ONLY — do not build yet.** Captured from Carlos's live teacher
walkthrough. Admin-side notes to be appended next, then we sequence the work.

Legend: 🟢 like / keep · 🔧 fix · ✨ new feature · 🎨 de-AI / polish · 🧭 decision needed ·
⚙️ needs external setup (accounts/APIs/$) · 🔬 research · ⏸ deferred (talk later)

---

## Home
- **TE-01 🔧🧭 Clarify the "New bookings · Accepting students" toggle (top-right).** Clicking
  it flips to "not accepting," but it's not clear to the teacher what it controls (active
  status? whether you appear for new bookings?). Make it obviously UX-friendly: a clear label,
  a one-line explanation of what ON vs OFF does, and ideally a confirm/helper so a teacher never
  thinks "what is this?". (This is the `accepting_students` control restyled this round —
  function is fine, the *meaning* needs to be self-evident.)
- 🟢 Home overall looks good / non-AI-slop. He likes it.

## My Schedule (Agenda)
- 🟢 Likes the "to confirm" + "upcoming confirmed" split. No action.

## My Students (Estudiantes)
- 🟢 Empty (no students yet) = normal. No action.

## Assignments (Tareas)
- **TE-D2 ⏸** Needs an end-to-end test with a real student before we can validate the flow.
  Hopefully the model is right; revisit once a student exists.

## Availability (Disponibilidad)
- **TE-02 🎨 Hover states feel "dead."** Hovering a button doesn't read as interactive — too
  subtle. Strengthen the hover affordance so buttons/chips clearly feel like buttons
  (.ek-quickrow / .ek-chip-toggle / .ek-outline-btn need more obvious hover feedback). Minor,
  but real.
- **TE-03 🔧🧭 Weekly-summary slot count looks off / unclear.** Adding **Mon 9am–6pm** saves
  correctly, but the weekly summary then shows just **"1 slot"** for Monday. Decide the model
  and fix the display: is a 9–18 window **one bookable block** or **N hourly slots**? How does a
  window become bookable times a student can pick? Then make the summary read sensibly
  (slots vs hours vs time-range). QA the whole add → save → summary flow.
- **TE-05 ✨🧭 Availability needs "a couple more tools" (Carlos, vague — clarify).** He felt the
  editor wants more tooling. Likely candidates to confirm: copy one day's slots to other days,
  recurring/template patterns, quick "business hours" fill, and block specific dates / vacation
  (out-of-office). Confirm scope before building.

## Earnings (Ganancias) — BIG ROCK
- **TE-04 ✨⚙️🧭 Rebuild Earnings as an Upwork-style payouts experience.** Model the UX on
  Upwork (structure, not necessarily wording). Built on the existing **Stripe Connect Express**
  payout infra (already in the stack). Pieces Carlos wants:
  - **Time sheet / "active contracts":** hours taught this week & this month, a calendar view,
    hour amounts.
  - **Balance:** available balance + pending balance; "Withdraw now" and "View earnings".
  - **Withdrawal schedule (editable):** frequency (quarterly / monthly / twice-monthly / weekly,
    e.g. every Wednesday) or "released on request"; a minimum-balance threshold (e.g. only when
    ≥ $X); next payout date; reserve balance.
  - **Edit withdrawal schedule:** preferred method; per-payment fee (~$1); "can take up to 2
    business days" note; minimum withdrawal amount.
  - **Withdrawal methods:** add a method, with **geo-recommended** options (Upwork auto-detects
    Honduras → Payoneer & PayPal at $1/withdrawal; wire $50; direct-to-US-bank free). Include the
    name-match warning + "up to 3 days to activate."
  - **Recent withdrawals:** history list.
  - 🧭 Decisions: which methods to actually support (Stripe Connect bank payout is simplest and
    already wired — vs adding PayPal / Payoneer / wire), the schedule rules, fees, min/reserve,
    and how/whether to geo-detect country.

## Materials (Materiales)
- **TE-D1 ⏸** Set up "materials" = the books/curriculum (same discussion as the student Library).
  How content is hosted/added is TBD — discuss later.

---

## Big rocks (need design + your input before building)
1. **TE-04 Earnings/payouts** — Upwork-style UX on Stripe Connect; resolve the method/schedule/
   fee/geo decisions first.
2. **TE-03 Availability slot model** — window vs hourly slots is a product decision that affects
   booking and the summary.

## Liked / keep as-is
Home (de-AI'd well), My Schedule (confirm + upcoming), the general non-AI-slop look.

---

_Next: append Carlos's admin-side walkthrough, then produce one sequenced build plan across
student + teacher + admin (decisions resolved first, one item at a time)._
