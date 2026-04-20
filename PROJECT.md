<!--
  PROJECT.md — source of truth for English Everywhere product intent.
  Claude Code MUST read this file on session start, and MUST NOT modify it
  without explicit instruction from Carlos. Technical details live in CLAUDE.md.
-->

# English Everywhere — Product Intent
_Confirmed with Carlos 2026-04-17._

---

## What English Everywhere is

An online English-tutoring platform for **Spanish-speaking Latin America**,
built around one core value proposition:

> **Learn English personally, with a real teacher, at ANY time — literally any
> time.**

Time flexibility is the main point. Everything else serves that.

A **future** direction (explicitly out of scope for the current phase) is
teaching Spanish to English speakers.

## Who it's for

- Primary learners: Spanish-speaking adults in Latin America who want 1-on-1
  English instruction on a schedule that fits their life.
- Not a marketplace of casual tutors — a structured program with a placement
  diagnostic, a plan, and a teacher assigned by the admin.

## People & roles

Three user roles. No others planned.

| Role | What they do |
|---|---|
| **Student** | Takes the free placement call, purchases a monthly package, gets classes assigned by admin, attends live video sessions. |
| **Teacher** | Lists availability, teaches assigned students, (later) benefits from AI-generated session summaries. |
| **Admin** | Runs the platform — does the placement diagnostic call, sets hourly rates, pairs students with teachers, marks placement tests complete. |

**Current humans:**

This is a **personal family project** — Carlos is the sole builder / owner /
admin. Andre is not involved. Keep this in mind for every "team" or "we"
reference in the codebase.

- **Carlos** — builder / owner / admin. Sets rates, runs operations, conducts
  the placement diagnostic call.
- **Lesly Paz** (`lesly@englisheverywhere.com`) — co-founder and currently the
  **only** active teacher. 119 availability slots seeded. Family member.
- **`admin@englisheverywhere.com`** — admin login.

## Pricing & packaging

- **Monthly packages only.** No pay-per-class, no annual.
- Four tiers by classes-per-month: **8 / 12 / 16 / 20**.
- 20 classes/month is the deliberate **ceiling** — chosen so students don't
  overbuy (e.g., 40 hours) and burn out. The cap reflects realistic capacity
  once homework and review are factored in.
- All classes are 1-on-1 with a teacher.
- Currency / exact prices: see DB / Stripe plan config (to be reconciled in
  the tech recon).

## Teacher economics

- **Rates are set by Carlos, not by teachers.**
- Current rate: **$7 USD/hour, net to teacher (take-home).** The platform does
  not take a cut from the teacher's rate. Platform revenue comes from the gap
  between the monthly subscription price and teacher pay.
  - Example (Spark, 8 classes, $129/mo): teacher earns 8 × $7 = $56.
    Platform margin = $73.
  - Example (Peak, 20 classes, $259/mo): teacher earns 20 × $7 = $140.
    Platform margin = $119.
- Rate can move up or down based on factors Carlos evaluates.
- Teachers cannot change their own rate.
- Teacher hiring today = direct hire (no open application yet). Adding more
  teachers is "easy" per Carlos — will happen as demand grows.
- **Future:** a teacher-application flow so external teachers can apply to
  join — not yet designed, not in current scope.

## Payments

- **Status: TBD.** Payments are simulated in code today (`simulatePurchase`
  sets `classes_remaining` + `current_plan`).
- Blocker: Carlos has a Stripe account for Remote ACKtive and does not want
  to commingle that with English Everywhere. Needs a separate Stripe entity
  / account decision before live payments can ship.
- Until that's resolved, treat Stripe integration as **not started**.

## Placement test — always a free human call

- Always a **human diagnostic call**. Never automated. Free.
- This is by design, permanent. Do not assume this will be automated later.
- Purpose: assess level, introduce the platform, set expectations about the
  course and the teacher.

## Booking flow (as clarified by Carlos)

Two paths a student can follow:

**Path A — recommended:**
1. Student takes the free human placement call.
2. Admin marks `placement_test_done = true` and (in the call) assigns a level.
3. Student purchases a monthly package → `classes_remaining` + `current_plan`.
4. Admin assigns a teacher to the student.
5. Student books classes against teacher availability.

**Path B — skip-the-call purchase:**
1. Student purchases a monthly package **without** having taken the placement
   call.
2. Student self-declares their CEFR level (e.g., C2 / B2 / A2) — presumably
   from a prior placement test they took elsewhere.
3. Admin still assigns a teacher. Class booking proceeds.
4. The free human call is still strongly recommended so student + teacher
   align on goals, but it is not a hard gate in Path B.

### Gaps flagged in the current flow (still open)

- **G1. Self-declared level has no verification.** A student in Path B can
  claim C2 and actually be A2. Do we want the teacher's first session to
  re-calibrate, or do we still route them to the free call before class 1?
- **G2. "Tell us your level" — channel unclear.** Does the student enter
  their level in the UI at checkout, email us, or tell the teacher? This
  affects what we store and when.
- **G3. Data model.** Is a self-declared level stored the same as a
  placement-verified level, or should we distinguish (e.g.,
  `level_source = 'self' | 'placement'`)?
- **G4. "AT ANY TIME" vs. one-teacher reality.** The core promise is 24/7
  availability, but today there's one teacher (Lesly). Carlos + Lesly accept
  this gap for now — plan is to onboard additional teachers quickly as
  student demand grows. Not a blocker.
- **G5. Order of operations for Path B.** Is a student allowed to book a
  class literally on day 1 of purchase, or does admin need to have assigned
  a teacher first? Today the DB supports both.

## AI session summaries — future feature, not shipped

- Concept: pull transcript / audio from the class, generate a summary.
- Summary should cover: what was covered, homework, things to work on,
  overall progression notes.
- Visible to both student and (probably) teacher.
- **Not in current phase.** Mark as planned, not built.
- _Implementation note:_ there is existing code in
  `src/app/actions/video.ts → generateSessionSummary` that calls Claude Haiku
  on `completeSession`. Carlos wants to revisit this later to choose the
  right model and prompt for token cost — so existing code should be treated
  as a sketch, not an active feature. See `CLAUDE.md` for the gating plan.

## Competitive context

`../COMPETITIVE_ANALYSIS.md` (parent folder, dated 2026-04-03) is **kept as a
living reference** — we use it to decide which competitor features to pull
in and which to deliberately not build (syllabus structure, guarantees,
scheduling UX, etc.).

Primary benchmark: **Alinea** (`inglesonline-alinea.com`), Costa Rica. Similar
Spanish-speaking LatAm focus, similar monthly-package model, WordPress stack.
Our edge is the 24/7 scheduling promise and a more modern, integrated platform
(LiveKit video in-app, Supabase-backed state, AI summaries later) vs.
Alinea's WordPress + WhatsApp coordination.

## Repo

- `https://github.com/cbanegas21/englisheveverywhere` — name has a typo
  (`eveverywhere`). Leave as-is for now; not worth the churn.
- Deploy: push to `main` → Vercel auto-deploy. Do not run `vercel` CLI.

---

## Out of scope (explicitly)

- Teaching Spanish to English speakers — future, different product motion.
- Open teacher marketplace / public teacher application flow — not now.
- Automated placement test — not ever (by design).
- Teachers setting their own rates — not planned.
- Parent accounts, B2B / corporate accounts, school partners — none planned.
