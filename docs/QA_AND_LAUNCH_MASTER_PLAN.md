# EnglishKolab — QA + Launch Master Plan

**Single source of truth.** Captures everything agreed in the 2026-06-08 working session so nothing gets missed. Companion docs: `QA_ENTERPRISE_FINDINGS.md` (the 73-defect audit + reusable test matrix), `STUDENT_QA_TICKETS.md` / `TEACHER_QA_TICKETS.md` / `ADMIN_QA_TICKETS.md` / `CALL_QA_TICKETS.md` (Round-2 walkthrough backlogs).

---

## 0. Where we are (already shipped)
- **Phases A / B / C** complete (de-AI sweep, full Call/classroom overhaul, site-wide timezone).
- **Phase D — Notifications:** email reminders honor `notification_preferences` (`7d2c127`); **confirmation email + `.ics` calendar invite** live (`33c0f6e`) — gives free, reliable 24h/1h reminders via the device's own calendar. **SMS dropped** (costly + low-use for HN). **WhatsApp deferred** as a future feature (n8n / cron / Cloud API; the `prefs.whatsapp` toggle is the wired-in hook).
- **Enterprise QA static audit** ran (19-agent workflow) → **73 verifier-confirmed defects** → `QA_ENTERPRISE_FINDINGS.md`.
- **Critical #1 fixed:** signup privilege-escalation (anyone could self-register as admin) — patched in `auth.ts`, deploying.

---

## 1. Foundation — fresh-start accounts  ⏳ awaiting "execute"
Nuke every account **except `admin@englishkolab.com`**, then create exactly two fresh logins → **3 accounts total**:
- `teacher@englishkolab.com` / `Teacher2026!` (active, approved)
- `student@englishkolab.com` / `Student2026!` (intake done, granted a plan)

Dry-run done (`scripts/qa-nuke-dryrun.mjs`, read-only). Plans/pricing untouched. *Open option:* swap to real inboxes if we want to receive QA emails. **This is the gate for the dynamic QA round** (needs login-able accounts).

---

## 2. Finish the audit — so we genuinely miss nothing
The static pass went deep on the high-risk logic but **sampled**, ran **one pass**, and **didn't run the app**. Two additions close that:

- **2a — Top-up STATIC round** (running now): dedicated agents for the gaps the first pass skipped — **landing/marketing page, onboarding + intake, assignments/homework, library, browse-teachers** — **plus a 2nd pass** on the deep surfaces (loop until finders come up empty). Each reads the existing findings first and only reports NEW issues.
- **2b — Dynamic PLAYWRIGHT round** (needs the 3 accounts): drive every surface as each role, **ES + EN, desktop + mobile** — catches runtime errors, visual/layout breakage, real concurrency that static can't see.

**Output:** one consolidated, de-duped, triaged **master bug backlog**.

---

## 3. Fix the bugs — in batches (each = code + any DB migration *on your OK* + QA + deploy)
- **Batch 1 — Live security:** privilege-esc ✅ + harden the `handle_new_user` trigger · Stripe webhook **amount-paid check** · lock the **unauthenticated AI endpoint** (`extractLiveVocab`) · fix the **rate-limiter** (XFF spoof + per-account lockout).
- **Batch 2 — Money / ledger integrity** *(the systemic weak point)*: status guards (`confirmBooking`, `completeSession`, `cancelBookingWithRefund`, `completeBooking` — stop resurrecting cancelled bookings) · atomic credit math (`createBooking`, `addStudentClasses` → existing `add_classes` RPC, unique `payments.booking_id`) · double-refund races · `GRANT UPDATE(accepting_students)` (toggle is a silent no-op today).
- **Batch 3 — Robustness:** date / Invalid-Date guards (placement, booking, duration whitelist) · `deleteMyAccount` false-success · **admin/conductor can't join any room** (bookings RLS) · block token mint for completed bookings · **add `error.tsx` / `not-found.tsx` / `global-error.tsx`** (none exist) · `escapeHtml` on ALL email HTML *(incl. the new `.ics` confirmation — same root)*.
- **Batch 4 — i18n / UX:** admin bookings calendar localization (violates the whole-app-localization rule) · lang-toggle drops query string · localize error copy · earnings currency · stray hardcoded strings.

---

## 4. Product decisions to lock (quick calls — flagged as we reach them)
- **"Remember me"** — wire it to real session persistence, or remove the decorative checkbox?
- **Signup email-enumeration** — switch to a generic message?
- **Far-future booking cap** — max horizon (e.g. 60 days)?
- **Dead subscription / billing-history UI** — remove, or build real receipts?
- **AD-06 ratings — REMOVE (confirmed):** drop the dead rating UI + columns.

---

## 5. The repeatable QA process (make it permanent)
- **Playwright regression suite** seeded from the audit's test matrix — runs on every change: zero console errors, no 404/500, the full role-permission matrix, ES + EN, desktop + mobile.
- **`enterprise-qa-hunt` workflow** — on-demand deep multi-agent sweep (re-run after big features).
- **Your human QA checklist** — the exploratory "does this actually make sense" steps you'll hand me, folded in alongside the automation. *(Still owe me: your steps.)*

---

## 6. Remaining feature phases (each ships *through* the QA process above)
- **Phase E — Teacher Earnings / payouts:** full Upwork-style UX per `TEACHER_QA_TICKETS.md` TE-04 (time sheet/active contracts, available + pending balance, **editable withdrawal schedule**, geo-detected methods for Honduras, recent withdrawals). v1 backend = bank payout + real balances live; richer methods/schedule shown-but-staged. Lock the live-scope at build start.
- **Phase F — Admin power tools:** impersonation + "acting-as" banner + `audit_log` · bookings-calendar upgrade + out-of-office (`teacher_unavailability`) · broader admin abilities · AD-01 follow-ups (admin detail pages, biblioteca localization, booking sub-panels) · **remove ratings**.
- **Phase G — Student progress / conversion:** ST-07 self-declared level · ST-09 edit learning profile · ST-10 reorder My Progress · ST-11 PDF report (net-new) · ST-15 call countdown · ST-02 profile photo · TE-03 availability slot-model display · TE-05 availability tools.

---

## 7. Loose ends
- **ST-18** support/contact link (reuse the existing `/contact` page).
- **`.env.local` secrets rotation** — verify it was done (flagged in the June-3 auth audit).
- **Manual QA you own:** live 2-person voice / screen-share check — the white active-speaker ring + the dual-PiP (can't be triggered without a second real person).

---

## 8. Parked by decision (revisit later)
- **WhatsApp notifications** (future worker; `prefs.whatsapp` hook ready).
- **Diploma** (ST-12) — legal + design research pass.
- **Books & curriculum content model** — focused design session (gates the student Library + teacher Materials + homework intake: ST-D1/D2, TE-D1/D2, AD-D1).

---

## Recommended sequence
1. **Now:** deploy critical fix → **execute the nuke** → finish Batch-1 security fixes.
2. **Parallel:** top-up static audit (running) → dynamic Playwright round (after nuke) → consolidated backlog.
3. Work **Batches 2→4** against the full backlog.
4. Lock the **repeatable QA process**.
5. Build **E → F → G**, each through QA.

> Security (Batch 1) runs in parallel with finishing the audit — it doesn't wait on the full backlog.
