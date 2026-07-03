# EnglishKolab — Deep Audit Synthesis Report

## 1. Executive summary

Overall the platform is in good shape: most money, auth, and hydration invariants are correctly guarded, and the audit confirmed the existing defenses hold in almost every area. **There is 1 confirmed CRITICAL and it IS a launch-blocker** — a student can mint themselves unlimited free class credits by inserting their own `students` row directly through the API (RLS-1). Below that: **1 high** (an admin "assign" action can silently resurrect a cancelled+refunded booking into a free class), **7 medium** (mostly wrong-language error text, one email bug, one double credit-subtraction, and two ops/monitoring gaps), **~18 low**, and **2 info**. Everything except RLS-1 can ship-and-patch, but RLS-1 must be fixed before launch.

---

## 2. Confirmed findings

### 🔴 CRITICAL

#### RLS-1 — Student can mint unlimited free credits
`supabase/schema.sql:666` (+ missing INSERT revoke on `students`)
- **What's wrong:** The RLS policy *"Students can insert own record"* lets a logged-in student POST directly to `/rest/v1/students` with any `classes_remaining` they want. Migration 016 only revoked UPDATE on the table (and 048 only locked bookings/sessions) — **INSERT on `students` was never revoked**, and the policy only checks `auth.uid() = profile_id`, not the columns.
- **Failure scenario:** User signs up + confirms email → lands on `/onboarding` but has no `students` row yet → with their real session JWT + the public anon key they insert `{profile_id: <own id>, classes_remaining: 999}`. Later `completeStudentOnboarding` upserts `onConflict: profile_id` and does **not** reset `classes_remaining`, so the 999 credits persist. They then book 999 classes for free. This is the exact hole 048 closed for bookings, left open on the credit ledger itself.
- **Fix:** Add a migration that `REVOKE INSERT ON public.students FROM authenticated, anon` (all writes already go through the service-role admin client), and drop the vestigial student INSERT/UPDATE write policies — mirroring migration 048.

---

### 🟠 HIGH

#### RACE-1 + AUTHZ-BULK-1 (merged — same root bug) — Admin "Assign" resurrects a cancelled/refunded booking
`src/app/[lang]/admin/actions.ts:329` (`assignAndConfirmBooking`)
- **What's wrong:** The assign update does `.update({teacher_id, status:'confirmed'}).eq('id', bookingId)` with **no status filter**, and the pre-select never even reads `status`. Every sibling write is status-gated (`completeBooking`, `cancelBookingWithRefund`, `adminRescheduleBooking`, teacher-side `confirmBooking` all use `.in('status', ['pending','confirmed'])`); this one is the lone exception. *(AUTHZ-BULK-1 flagged the same root defect from the authz angle; RACE-1 from the race angle.)*
- **Failure scenario:** Student cancels a booking ≥24h out → `studentCancelBooking` sets `status='cancelled'` and refunds the credit via `increment_classes`. Admin, working from a bookings list loaded before the cancel, clicks **Assign** → the row is flipped back to `confirmed` with a teacher. The student now holds **both** the refunded credit **and** a live confirmed class; when it completes, the teacher is paid = free class + credit inflation. Also re-sends a "confirmed" email for a cancelled class, and can regress a `completed` booking back to `confirmed` (reopening its `/sala`).
- **Fix:** Add `.in('status', ['pending','confirmed'])` to the assign update and check the affected row count; refuse if zero rows matched.

---

### 🟡 MEDIUM

#### MON-1 — Refund + dispute double-subtracts credits
`src/app/api/stripe/webhook/route.ts:340`
- **What's wrong:** The refund guard (`refund-{chargeId}`) and dispute guard (`dispute-{chargeId}`) are independent sentinels with no cross-check, and the dispute path never inspects `charge.refunded`/`amount_refunded`.
- **Failure scenario:** A charge is fully refunded (−10 credits), then the cardholder disputes that same charge at their bank (real Stripe flow — refund does not block a later chargeback). The dispute path decrements another 10, wiping credits from a *different, non-refunded* pack. `decrement_classes_by` floors at 0, so the loss is silent.
- **Fix:** Before decrementing on dispute, check whether `refund-{chargeId}` already exists (or read `charge.amount_refunded`) and skip the second subtraction.

#### EML-1 — Student reschedule sends a false "class confirmed" email
`src/app/actions/booking.ts:736`
- **What's wrong:** `studentRescheduleBooking` drops the booking to `pending` (teacher must re-confirm) but unconditionally calls `scheduleBookingReminders`, which always sends the "Your class is confirmed" email (no status/teacher check).
- **Failure scenario:** Student reschedules 25h out → instantly gets "Your class is confirmed" + .ics for a booking that is actually pending (while the toast says "your teacher will confirm soon"). If the teacher declines, the student was told it was confirmed. If the teacher confirms, a **second** identical confirmation fires. Rescheduling a still-unassigned booking even sends "with your teacher *Maestro*" (fallback name). The admin reschedule path explicitly guards this exact case and calls it "a false confirmed email."
- **Fix:** Only send the confirmation when `status==='confirmed'` and `teacher_id` is set — copy the guard already present in `admin/actions.ts:707-716`.

#### HYD-1 — Reschedule panel hydration error (am/pm spacing)
`src/app/[lang]/admin/bookings/RescheduleRequestsPanel.tsx:67`
- **What's wrong:** `formatDateTime` renders es-HN am/pm time without the whitespace normalization (`.replace(...)`) that every sibling formatter on the same page applies — the one survivor of the systemic #418 class.
- **Failure scenario:** Admin opens `/es/admin/bookings` with ≥1 pending reschedule request → Node's ICU emits a different space before "p. m." than the browser's → React #418 hydration error (recoverable, admin-only, but noisy).
- **Fix:** Apply the same `.replace(/[\u00A0\u202F]/g, ' ')` normalization used at `BookingCalendarClient.tsx:413/1359/1416`.

#### I18N-1 — Profile settings show English errors on Spanish pages
`src/app/actions/profile.ts:49`
- **What's wrong:** `updateStudentProfile`/`updateTeacherProfile` take no `lang` param and return English-only strings ("Name is required", "Too many attempts…", etc.); `updateStudentProfile:99` also reflects the raw Postgres error.
- **Failure scenario:** An ES student on `/es/dashboard/configuracion` clears their name and saves → the Spanish page shows "Name is required" in English.
- **Fix:** Thread `lang` through both actions and return localized copy (as sibling `requestEmailChange` already does); never reflect raw PG strings.

#### INJ-1 — Teacher bio has no maximum length
`src/app/actions/onboarding.ts:113` *(one lens rated this low, one medium)*
- **What's wrong:** `completeTeacherOnboarding` enforces a minimum bio length but no maximum, while sibling `updateTeacherProfile` caps at 2000 chars and the DB column has no CHECK.
- **Failure scenario:** A teacher-role account posts a ~900KB bio (bounded only by Next's ~1MB body limit); it's stored verbatim, re-writable on every re-onboard, and shipped whole in the admin teachers list payload and the student-facing profile — permanently bypassing the 2000-char cap.
- **Fix:** `.slice(0, 2000)` the bio in onboarding, matching `updateTeacherProfile`.

#### OPS-1 — Migration 058 silently disabled a rate limit
`supabase/migrations/058_auth_attempts_uploads.sql:15`
- **What's wrong:** 058 re-created the `auth_attempts_action_check` constraint but **dropped** `saveTeacherVeemPayout` (added in 049), despite its "additive only" comment. The live schema dump confirms the value is missing.
- **Failure scenario:** `payouts.ts:18` rate-limits with `failClosed=false`, so the constraint-violating INSERT fails and the limiter returns `ok:true` every time → a scripted teacher can hammer `saveTeacherVeemPayout` unbounded (email churn + a Veem-email enumeration oracle via the 23505 response).
- **Fix:** New migration re-adding `saveTeacherVeemPayout` (and any other dropped values) to the CHECK.

#### OPS-2 — Google login can vanish silently on env drift
`src/lib/envCheck.ts:41`
- **What's wrong:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is load-bearing but not in envCheck's CRITICAL list; `GoogleButton` returns `null` if it's unset, with no Sentry signal.
- **Failure scenario:** The var is deleted/typo'd in Vercel and the app redeploys → the Google button disappears on `/login` and `/registro` with zero alert; Google-signup students (who have no password) lose their only login method until they run a password reset.
- **Fix:** Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the envCheck CRITICAL list.

---

### 🟢 LOW

- **MON-2** `stripe/webhook/route.ts:313` — Refund/dispute reversal subtracts the *current* `CLASS_COUNTS[planKey]` instead of the `classes_added` recorded at purchase, so if a pack's class count is ever changed the reversal drifts (student keeps free credits or loses credits from other packs). *Fix: read `classes_added` from `student_purchases`.*
- **PAY-1** (`money-payouts`) `src/app/actions/video.ts:535` (+ `admin/actions.ts:993`) — Per-class payout is `Math.round(rate*duration/60)`, but rates allow 2 decimals, so a $22.50 rate pays $23/class (systematic ±$0.50 drift into the Veem sweep). *Fix: keep cents precision instead of rounding to whole dollars.*
- **MON-3** `src/app/actions/booking.ts:215` (+ `admin/actions.ts:1369`) — The compensating `increment_classes` refund after a failed booking insert is fire-and-forget; its error is neither checked nor logged, so a double transient failure eats a paid credit with no observability. *Fix: check the RPC result and log/Sentry on failure.*
- **AUTHZ-RESCHED-2** `src/app/actions/booking.ts:434` — `requestReschedule`/`cancelRescheduleRequest` return raw Postgres error text to the browser, and `reason` is persisted with no length cap. *Fix: route through `bookingActionErrorMsg`; `.slice()` the reason.*
- **RLS-3** `supabase/schema.sql:552` — The "Teachers manage own availability" FOR ALL policy lets a teacher write `availability_slots` directly via REST, bypassing the server-side overlap guard (confined to their own rows; no money path). *Fix: drop the write policy + revoke write grants (mirror 048).*
- **RACE-3** `src/app/actions/assignments.ts:165` — `cancelAssignment` cancels without re-asserting no-submission, so a concurrent student submit yields `status='cancelled'` **with** a submission row (the student's work then hides from their own view). *Fix: add `.eq('status','open')` to the cancel update.*
- **RACE-4** `src/app/actions/placement.ts:88` — Duplicate-placement pre-check is check-then-insert with no DB backstop for different timestamps; a double-fire creates two live placement bookings + double admin emails (no money, placement is free). *Fix: partial unique index on one live placement per student.*
- **RACE-5** `src/app/[lang]/admin/actions.ts:248` — `toggleTeacherActive` snapshots live bookings before writing `is_active=false`; an `assignAndConfirmBooking` committing in the gap (or from a stale tab) leaves a confirmed booking on a deactivated teacher that is never re-queued. *Fix: check `is_active` in the assign action.*
- **HYD-2** `.../teachers/[teacherId]/TeacherProfileClient.tsx:341` — `sessionsThisMonth` is bucketed by host-tz `new Date().getMonth()` in the render body (SSR=UTC vs client-local) → month-end hydration mismatch + wrong-month stat. *Fix: anchor to a `serverNowMs` prop + pin `America/Tegucigalpa`.*
- **I18N-2** `src/app/actions/booking.ts:432` — `requestReschedule` returns English-only errors + raw PG message on the ES teacher agenda. *(Both lenses rated this low despite the medium tag.)* *Fix: thread `lang`, use the existing `tx.rescheduleError`.*
- **I18N-3** `src/app/actions/booking.ts:539` — Student booking-action guard paths ("Not authenticated", "Booking not found", etc.) are raw English while siblings are localized. *Fix: localize the guard strings.*
- **I18N-4** `src/app/actions/placement.ts:502` — `teacherSetStudentLevel` returns English-only errors shown raw in the ES teacher panel. *Fix: thread `lang`.*
- **I18N-5** `.../configuracion/ConfigTeacherClient.tsx:80` — The save-error fallback is a hardcoded Spanish literal "Error al guardar", so EN teachers get Spanish. *Fix: move to the `t` dictionary.*
- **I18N-6** `.../agenda/AgendaClient.tsx:463` (+ `EstudiantesClient.tsx:104`, `sala/[bookingId]/page.tsx:75`) — Hardcoded English "Student"/"Teacher" fallbacks render on ES surfaces. **Note:** one lens found this fires for *every* student (not just null names) because the teacher's session client can't read student `profiles` rows under RLS, so the embed returns null and the fallback always shows — meaning the teacher agenda never shows real student names. *Fix: fetch names via the service-role client after the ownership check (as `tareas`/`ganancias` already do) and localize the fallbacks.*
- **EML-2** `src/app/actions/placement.ts:411` (+ `stripe/webhook/route.ts:240`) — `email_suppressed` (bounce/complaint flag) is checked only in `reminders.ts`; placement confirmations and Stripe receipts still send to suppressed addresses, hurting sender reputation. *Fix: check `email_suppressed` in these senders too.*
- **EML-3** `src/app/api/stripe/webhook/route.ts:240` — The purchase-receipt email is an un-awaited `fetch(...).catch(()=>{})` with no `after()`, so it can be killed when the serverless instance suspends — silent, no log (credits still land). *Fix: wrap in `after()` like `reminders.ts` already does.*
- **INJ-3** `src/app/actions/profile.ts:99` — `updateStudentProfile` (and avatar/currency actions) reflect raw PG error text; `preferredLanguage` is passed through unvalidated, giving a guaranteed way to trigger a CHECK-violation string. *Fix: validate `preferredLanguage` at runtime + return generic localized errors.*
- **INJ-4** `src/app/actions/intake.ts:33` (+ `onboarding.ts:133`) — `formData.get(...)` is cast to string and `.trim()`'d with no `typeof` check; posting a File under that key throws an unhandled TypeError (attacker-only crash of own request). *Fix: use a `typeof`-guarded coercer like `lab.ts`'s `str()`.*

---

### ⚪ INFO

- **SALA-2** `src/app/actions/video.ts:471` — `completeSession` overwrites `sessions.ended_at` before the status gate, so replaying it on a completed booking keeps rewriting `ended_at` (money path stays idempotent; only affects the lab vocab `.order('ended_at')`). *Fix: gate the `ended_at` write on status too.*
- **SALA-3** `src/app/actions/video.ts:246` — Attendance (`student_joined_at`, which mints payout) is stamped on student **page load** within the 10-min grace, including a load that only reaches the pre-start lobby and never connects. A student who opens the reminder link at T-9m and bails is recorded as attended → teacher paid for a no-show. The ≤10-min boundary is a documented design call; only the lobby-vs-connected residual is flagged. *Fix: stamp on actual LiveKit connect (or lobby "Enter") instead of page load.*

---

## 3. Plausible findings (need a human call)

#### RACE-2 — `bulkAssignTeacher` has the same resurrection hole as RACE-1
`src/app/[lang]/admin/actions.ts:1631`
- **Flagged because:** the code pattern is identical to RACE-1 (unconditional `.update({status:'confirmed'}).in('id', bookingIds)`), and it's an exported `use server` admin action — a latent hole the moment anything calls it.
- **Cleared because:** repo-wide grep shows **it has zero callers** — no admin UI imports it and there's no multi-select bulk-assign screen, so the described race has no trigger today.
- **Your call:** Fix it anyway when you fix RACE-1 (same one-line change), or delete the dead function. Low effort either way.

#### RLS-4 — `reschedule_requests` student write policies allow direct REST mutation
`supabase/schema.sql:636`
- **Flagged because:** the student INSERT/UPDATE policies have no column-level WITH CHECK, so a student can PATCH `status`/`proposed_scheduled_at`/`reason` on their own booking's request via REST — vestigial write surface the 048 cleanup missed.
- **Cleared because:** it produces no real harm — setting `status='approved'` does **not** move the booking (only the admin action, which re-validates, can), the student already has a legitimate self-reschedule action, and there's no cross-user reach or money path. At worst a self-defeating grief on their own class.
- **Your call:** Drop the policies as defense-in-depth hygiene (consistent with 048), or accept as harmless.

#### INJ-2 — `notification_preferences` stored with zero validation
`src/app/actions/profile.ts:89`
- **Flagged because:** the jsonb blob is written verbatim (no whitelist/coercion/size cap) and rides along in reminder/admin/settings queries — deviates from the codebase's own `normalizeSettings` pattern.
- **Cleared because:** every consumer reads it defensively (no crash), it's bounded to ~1MB in the caller's **own** row (overwrite, not append), rate-limited, and there's no money/leak/auth impact.
- **Your call:** Add a small `normalizeSettings`-style whitelist for hygiene, or accept as a non-issue.

#### OPS-5 — `STRIPE_PRICE_*` not in envCheck CRITICAL
`src/lib/envCheck.ts:41`
- **Flagged because:** a typo'd price id deploys with no cold-start signal; it's discovered only when the first paying customer's checkout fails — later than every other money var's alert.
- **Cleared because:** the path **fails closed** (no charge, no fake success, graceful "plan temporarily unavailable" + Sentry fatal), and a typo'd-but-present var would pass an envCheck presence test anyway.
- **Your call:** Purely a monitoring-latency preference. Optionally add a startup validation that the price ids start with `price_`.

#### OPS-4 — CSP `img-src` allows unused `cdnjs.cloudflare.com`
`next.config.ts:40`
- **Flagged because:** verified zero consumers repo-wide — an allowed-but-unused origin widens the image surface slightly.
- **Cleared because:** no functional failure; cdnjs is a curated public CDN (an attacker can't host or read logs there), and `img-src` already allows broader origins. Pure hygiene.
- **Your call:** Delete the origin (costs nothing) or leave it.

---

## 4. Prioritized fix plan

**Before launch (blocker):**
1. **RLS-1** — Migration: `REVOKE INSERT ON public.students` from authenticated/anon + drop the student write policies. *(Critical paywall bypass.)*

**Immediately after / same PR batch (money + integrity):**
2. **RACE-1 / AUTHZ-BULK-1** — Add `.in('status',['pending','confirmed'])` + row-count check to `assignAndConfirmBooking`; apply the same to `bulkAssignTeacher` (RACE-2) while you're there.
3. **MON-1** — Cross-check the refund sentinel before decrementing on dispute.
4. **OPS-1** — Migration re-adding `saveTeacherVeemPayout` (and any other dropped values) to `auth_attempts_action_check`.
5. **EML-1** — Guard `scheduleBookingReminders` on confirmed+assigned in `studentRescheduleBooking`.

**Next batch (medium: monitoring + UX):**
6. **OPS-2** — Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to envCheck CRITICAL.
7. **HYD-1** — Normalize am/pm whitespace in the reschedule panel.
8. **I18N-1** — Localize profile-settings errors (thread `lang`, no raw PG).
9. **INJ-1** — Cap teacher bio at 2000 chars in onboarding.

**Low-effort cleanup batch (group these — mostly one-liners):**
10. i18n localization sweep: **I18N-2, I18N-3, I18N-4, I18N-5, I18N-6** (thread `lang`, move literals to dictionaries, use service-role for teacher-side student names).
11. Money hardening: **MON-2** (read `classes_added`), **PAY-1** (keep cents), **MON-3** (check the compensating RPC).
12. Race/DB guards: **RACE-3** (status filter), **RACE-4** (unique index), **RACE-5** (`is_active` check), **RLS-3** (drop availability write policy).
13. Robustness: **AUTHZ-RESCHED-2** (generic errors + cap reason), **INJ-3** (validate `preferredLanguage` + generic errors), **INJ-4** (typeof-guard formData), **EML-2** (suppression check), **EML-3** (`after()` on receipt), **HYD-2** (serverNowMs anchor).

**Optional / accept-or-hygiene:** SALA-2, SALA-3, and the plausible items (RLS-4, INJ-2, OPS-4, OPS-5) — decide per section 3.

*No confirmed critical remains once RLS-1 is patched. Everything from HIGH down is ship-and-patch.*