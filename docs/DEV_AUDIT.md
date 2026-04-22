# EnglishKolab — Developer Audit (50 questions answered from code)

Generated 2026-04-21. Source questions: `docs/BACKLOG_QUESTIONS.md` (questions 1–50 of the developer block). Answers reflect repo state after the hardening fixes in commit `cbb9a58` (webhook idempotency, auth rate limit, Sentry) and the post-audit webhook race patch in `f5dfa0b`, plus Phase A/B/C/D work (cancel/reschedule/no-show, GDPR delete, per-user timezone).

Columns: **#** = question  •  **Answer** = what the code actually does, with `file:line` refs  •  **Gap** = "none" if fully covered, otherwise what's still missing.

---

## 1. Architecture & scale

| # | Question | Answer | Gap |
|---|---|---|---|
| 1 | Webhook idempotent against Stripe retries? | Yes. `processed_stripe_events` has `id text primary key` (migration 024). Every webhook inserts `event.id` **before** processing (`src/app/api/stripe/webhook/route.ts:56-67`). A duplicate (23505) short-circuits with `{received: true, duplicate: true}`. Post-`cbb9a58` we also **release the ledger claim on DB-write failure** (`route.ts:179-190`) so a partial-success retry can complete. | None |
| 2 | Do we log webhook failures anywhere actionable? | `console.error(...)` for ledger + processing errors (`route.ts:65, 103, 180`). Sentry captures uncaught exceptions (`sentry.server.config.ts`). Handled errors (DB write failed, unknown plan) only hit console — not forwarded to Sentry explicitly. | Add `Sentry.captureMessage()` for handled processing errors |
| 3 | Race when two students book same slot? | Enforced by `UNIQUE INDEX bookings_student_time_unique ON bookings(student_id, scheduled_at) WHERE status <> 'cancelled'` (schema.sql:306). Protects against **same student** double-booking. Cross-student slot contention is not yet gated — teacher_id is null at creation (admin-assigns later) so two students CAN reserve the same wall-clock slot; admin sees both in the queue. | Add teacher-side conflict check at admin-assignment time |
| 4 | RLS enabled on every user-data table AND tested? | `alter table ... enable row level security` in `supabase/schema.sql:331+` for all user tables. Tier-0 drift probe at `tests/e2e/schema-drift-probe.spec.ts` validates CHECKs/unique indexes exist, but **does not test RLS policies end-to-end**. | No dedicated RLS-policy test suite |
| 5 | Can student A query student B's `payments` row? | No. Policy `"Students see own payments" on payments for select using (auth.uid() = (SELECT students.profile_id ...))` (`schema.sql:380`). Requires a server-side join that RLS re-evaluates per-row with the caller's `auth.uid()`. | None |
| 6 | `service_role` key only used server-side? | Yes. `createAdminClient()` reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) → Next build-time tree-shakes it out of any client bundle (`src/lib/supabase/admin.ts:1-14`). Browser clients go through `createClient()` in `client.ts`/`server.ts` which use the anon key. | None |
| 7 | Rollback plan for a bad prod deploy? | Vercel dashboard → "Instant Rollback" on any prior deployment (Vercel native). `git revert` + `git push origin main` also triggers rebuild. DB migrations are additive — no `DROP` is run except in dedicated migrations 011/023 which are themselves reversible. | No documented runbook; user knows implicitly |
| 8 | Staging/preview env? | Vercel auto-generates preview URLs on non-main branches. All preview deploys point at the **production Supabase**. No separate staging DB. | No isolated staging env — risky for schema tests |
| 9 | Supabase backups automated? | Supabase Pro plan: daily backups retained 7 days (project default). `CLAUDE.md` doesn't document the plan tier — verify in Supabase dashboard. | Verify tier + document restore procedure |
| 10 | Point-in-time restore? | Available on Pro plan via Supabase console ("Point-in-Time Recovery" under Database > Backups). Never exercised in this repo. | Untested — run a restore drill before launch |

## 2. Security

| # | Question | Answer | Gap |
|---|---|---|---|
| 11 | Rate limiting on `/api/stripe/webhook`? | No app-level limit. Protected instead by **signature verification** (`stripe.webhooks.constructEvent`, `route.ts:41`) — a flood without a valid signature returns 400 in O(ms). Not formally rate-limited. | Add Vercel Edge Middleware rate cap if abuse shows up |
| 12 | Rate limiting on `/login` + `/registro`? | Yes. `checkAuthRateLimit()` in `src/lib/rateLimit.ts` checks `auth_attempts` table (IP + action + 15-min window). Thresholds: login = 10/15min, signup = 5/15min (`rateLimit.ts:17-24`). Called from `signIn` (`auth.ts:144`) and `signUp` (`auth.ts:33`). | None |
| 13 | CAPTCHA on signup? | No. Only the 5/15min IP limiter + Supabase's project-wide bucket. | Add hCaptcha or Turnstile if bot traffic appears |
| 14 | `CRON_SECRET` set in Vercel prod? | **Moot** — cron was ripped out 2026-04-21. Reminders now use Resend's native scheduled-delivery (`src/lib/reminders.ts`). No `/api/cron/*` route exists. | None |
| 15 | 2FA enforced on admin accounts? | No. Admin role is a column `profiles.role = 'admin'` checked in server actions. No MFA on Supabase Auth. | **Blocker for launch** — enable MFA on admin users |
| 16 | SPF/DKIM/DMARC for englishkolab.com? | Configured in Resend dashboard (verified domain — Resend won't send otherwise). Not surfaced in repo. | Verify DMARC = `p=quarantine` or stricter before mass sending |
| 17 | Password policy? | Minimum 8 characters enforced in `src/app/actions/auth.ts:43-48` before hand-off to `supabase.auth.signUp`. No complexity (mixed case / symbols) enforced. | Consider zxcvbn or complexity rules |
| 18 | Supabase anon key safe to expose? | Yes IF RLS is airtight. Our tables all have RLS enabled (Q4). Anon key is `NEXT_PUBLIC_SUPABASE_ANON_KEY` — intentionally public. | None assuming Q4 coverage holds |
| 19 | CVE scanning on deps? | None wired. `pnpm audit` not run in CI. Dependabot not configured. | Wire GitHub Dependabot — 0 effort, catches CVEs |
| 20 | WAF / abuse protection? | Only Vercel's default edge DDoS protection. No Cloudflare/WAF in front. | Add Vercel Firewall rules if abuse appears (paid) |

## 3. Reliability & errors

| # | Question | Answer | Gap |
|---|---|---|---|
| 21 | Anthropic fails → completeSession still saves booking + payment? | Yes. `completeSession` writes booking/session/payments **before** calling `generateSessionSummary` (`src/app/actions/video.ts:270-323`). Summary is wrapped in `.catch(() => null)` (`video.ts:321`) so a Claude outage never rolls back the sale. | None |
| 22 | Retry failed AI summaries? | No. One shot per completeSession call. If Claude returns non-200 or non-JSON, `generateSessionSummary` returns `null` silently (`video.ts:211-226`). | Add a "Regenerate summary" button in teacher UI |
| 23 | Resend down → queue or drop? | Drop. All email sends are fire-and-forget `.catch(() => {})` (`booking.ts:49`, `reminders.ts:146-148`). Reminder scheduling goes to Resend's native scheduler — if **that** request fails, the ID is null and not persisted. | No retry/queue — consider on launch traffic |
| 24 | LiveKit token expires mid-class? | TTL = 7200s = 2h (`video.ts:122`). Classes are 60min; 90-min late-join cap means max session length ≈ 150min, so a 120min token can expire inside a long over-run. LiveKit client auto-refresh is not wired. | Long-tail: implement `onDisconnected` re-fetch |
| 25 | Transcripts persist after disconnect? | Yes if the teacher's browser calls `saveSessionTranscript()` before `completeSession` (`video.ts:339-373`). Captured text lives in `sessions.transcript` (migration 022). If teacher closes the tab mid-class with no save, transcript is lost. | No auto-flush — could add periodic save |
| 26 | Supabase JWT expires mid-booking-flow? | `@supabase/ssr` refreshes tokens automatically on server-side `createClient()` calls. Browser-side refresh handled by the client SDK. `autoRefreshToken: false` on the admin client (service-role) is intentional. | None |
| 27 | `decrement_classes` handles concurrent calls? | RPC is `SECURITY DEFINER` with `UPDATE ... SET classes_remaining = classes_remaining - 1 WHERE id = ... AND classes_remaining > 0` (migrations 005 + 012). Atomic at row level — two concurrent decrements cannot both land below zero because the `> 0` guard re-checks per-row. | None |
| 28 | Refund when `classes_remaining = 0` goes negative? | Guarded by `Math.max(0, (classes_remaining || 0) - CLASS_COUNTS[planKey])` in webhook `charge.refunded` branch (`route.ts:149`). Floors at zero. | None |
| 29 | Errors going to Sentry? | Yes. `@sentry/nextjs:^10.49.0` wired in `sentry.{client,server,edge}.config.ts`, gated on DSN presence (`sentry.server.config.ts:11`). Captures uncaught exceptions in server actions, route handlers, and RSC. `tracesSampleRate: 0.2`. | Handled errors (Q2) not forwarded explicitly |
| 30 | Public status page / uptime SLA? | None. Vercel + Supabase each expose their own status pages; we aggregate nothing. | No customer-facing status — add `status.englishkolab.com` later |

## 4. Data integrity

| # | Question | Answer | Gap |
|---|---|---|---|
| 31 | Delete student → bookings/payments/sessions cascade? | `students → bookings: ON DELETE CASCADE` (schema.sql:247). `bookings → sessions: CASCADE` (schema.sql:256). `bookings → reschedule_requests: CASCADE` (:253). **`payments.student_id` has NO cascade** (:250) — a hard DELETE would fail with FK violation. GDPR path uses soft-delete via migration 026 (`profiles.deleted_at` + PII scrub) so this is intentional — payments stay for accounting. | Document the soft-vs-hard distinction for compliance |
| 32 | Delete teacher → cascade? | Same shape. `teachers → bookings: CASCADE` (schema.sql:248), `teachers → availability_slots: CASCADE` (:245), `teachers → assignments: CASCADE` (:244). `payments.teacher_id` no cascade (:251). Again: soft-delete is the intended path. | Same as Q31 |
| 33 | GDPR delete account documented? | Yes — shipped Phase C. `deleteMyAccount()` in `src/app/actions/profile.ts` scrubs PII from `profiles` (email → redacted, full_name → "Deleted user", phone/bio/avatar → null), sets `profiles.deleted_at`, rotates auth password, signs out. Migration 026 adds the `deleted_at` column + index. UI: `/[lang]/dashboard/configuracion → DangerPanel`. | None — runbook could be written but behaviour is in code |
| 34 | CCPA data export? | Not built. No `exportMyData()` server action. | **Launch blocker for CA users** — add export to JSON endpoint |
| 35 | `sessions.transcript` ever purged? | Never. Migration 022 adds the column, no retention job scrubs it. Soft-deleted profiles leave transcripts intact. | Add retention: purge transcript 90d after ended_at |

## 5. Edge cases

| # | Question | Answer | Gap |
|---|---|---|---|
| 36 | Honduras no DST, US yes — display handles it? | Yes after Phase D. Every booking display + reminder uses `profiles.timezone` (IANA zone) via `toLocaleString(..., { timeZone })` (`reminders.ts:57-64`, `agenda/AgendaClient.tsx` + 4 dashboard pages). `safeZone()` (`reminders.ts:46-55`) falls back to `America/Tegucigalpa` on invalid zones. IANA handles DST per-zone. | None |
| 37 | Student in MX, teacher in HN — each sees local time? | Yes after Phase D. Reminder emails render once per recipient with their own `profile.timezone` + `preferred_language` (`reminders.ts:260-285`). Dashboard pages read `profiles.timezone` (not stale `user_metadata.timezone`) and pass it into the client. | None |
| 38 | Booking in past blocked? | Yes. `createBooking` checks `scheduledDate < minAllowed` where `minAllowed = now + 24h` (`src/app/actions/booking.ts:62-70`). Past times hit the same branch. | None |
| 39 | Booking <24h blocked? | Yes. Same guard as Q38 (`booking.ts:62-70`) — hard server-side reject with i18n error. Client-side `AgendarClient` also greys out <24h cells. | None |
| 40 | Teacher cancels 30 min before — what does student see? | Teachers cannot unilaterally cancel a confirmed class. They can **decline pending** (`declineBooking`, `booking.ts:174`) or **request reschedule** (`requestReschedule`, :225) — admin approves. For emergencies, admin cancels in `/admin/bookings` and `cancelBookingReminders` wipes scheduled emails. Student sees the cancelled booking in their dashboard but **no push notification is wired**. | No realtime notification — send abandon-email on admin cancel |

## 6. Product correctness

| # | Question | Answer | Gap |
|---|---|---|---|
| 41 | "Session recordings" marketed but not built? | Confirmed not built. No LiveKit Egress pipeline, no recording storage. Marketing copy (`/[lang]` landing) implies AI summaries, not video recordings — but `docs/USER_AUDIT.md` Q37 flags this as a perception gap. | **Launch blocker per USER_AUDIT** — decide: build vs strip copy |
| 42 | `admin/overview` shows live or stale totals? | Live. `src/app/[lang]/admin/page.tsx` queries `payments` with aggregations per request (SSR) — no caching layer, no `revalidate` config. Every admin page load hits the DB. | Consider `revalidate: 60` once traffic grows |
| 43 | Webhook handles legacy plan keys (starter/estandar/intensivo)? | Yes. `CLASS_COUNTS` in `route.ts:9-18` includes aliases mapping old keys to current tier classes (`starter → spark`, `estandar → drive`, `intensivo → ascent`). Safe for in-flight old checkouts. | None |
| 44 | Refund-reversal works if user deleted before refund? | Soft-deleted profile keeps `students` row + `profile_id` intact (GDPR scrub leaves the row). Webhook `charge.refunded` looks up by `profile_id` and decrements `classes_remaining`. Works. If a **hard** delete ever happened, the lookup returns null and the webhook logs + acks (no retry loop). | None (soft-delete assumption holds) |
| 45 | Webhook verifies Stripe signature before processing? | Yes. `stripe.webhooks.constructEvent(body, signature, webhookSecret)` at `route.ts:41` throws on mismatch → 400 response. Dev mode (placeholder keys) short-circuits to 200 without processing (`route.ts:24-27`). | None |

## 7. Ops

| # | Question | Answer | Gap |
|---|---|---|---|
| 46 | Paginate long booking lists? | Mostly no. Admin bookings page pulls all non-cancelled bookings in one query. Teacher `/maestro/dashboard/clases` is capped via `.limit(10)` on the upcoming-confirmed query (`maestro/dashboard/page.tsx:35-50`). Student-side clases page has no limit. | **Add pagination before 1k+ bookings exist** |
| 47 | Largest query indexed? | Yes for the hot paths. Indexes on `bookings(scheduled_at)`, `bookings(student_id)`, `bookings(teacher_id)`, partial indexes for pending-assignment queues (schema.sql:306-311). `auth_attempts(ip, action, attempted_at DESC)` supports the rate limiter. `profiles(deleted_at) WHERE deleted_at IS NOT NULL` supports GDPR queries. | None |
| 48 | `bookings.scheduled_at` indexed for reminder scan? | **Moot** — cron removed. Resend-native scheduling replaces polling. Index still exists and serves the dashboards. | None |
| 49 | Email-send non-blocking? | Yes. All Resend sends use `.catch(() => {})` or `Promise.all(...)` after the DB write has committed. Reminder scheduling is awaited inside a `.catch(() => {})` wrap at the call site (`booking.ts:168`). | None |
| 50 | Feature flags for gradual rollouts? | None. Every code path lives in main and ships immediately on `git push origin main` → Vercel. Env-based branches (`process.env.STRIPE_SECRET_KEY.endsWith('_placeholder')`) act as implicit dev vs prod flags but aren't user-scoped. | No per-user / percentage rollout — fine for MVP |

---

## Top 10 dev-side launch blockers (cross-cutting)

Ordered roughly by severity.

1. **No MFA on admin accounts** (Q15) — a compromised admin password owns the whole platform. Enable Supabase Auth MFA before launch.
2. **No CCPA data export** (Q34) — required for California users; only GDPR-delete exists.
3. **No cross-student slot conflict check** (Q3) — two students reserving the same wall-clock slot burden the admin queue; could hit teacher double-booking at assignment.
4. **Session transcripts never purged** (Q35) — PII accumulates forever. Add 90d retention.
5. **No dedicated RLS-policy test suite** (Q4) — drift probe covers schema, not policies. One bad migration could open a hole silently.
6. **No CVE scanning** (Q19) — 0-effort fix via Dependabot.
7. **All traffic → prod Supabase even from Vercel previews** (Q8) — a preview-branch migration or seed could clobber prod data.
8. **No payment/student cascade** behaviour is a feature, not a bug — but **no soft-delete runbook exists** (Q31/32/33).
9. **No retry on failed AI summaries** (Q22) — silent data loss. Regenerate button = small feature.
10. **Recording marketing claim with no feature** (Q41) — cross-referenced in USER_AUDIT Q37. Same decision: build vs strip.

## Quick wins (low effort, high impact)

- Wire Dependabot (Q19, ~5 min GitHub Settings toggle).
- Forward handled webhook errors to Sentry via `Sentry.captureMessage()` (Q2, ~15 min).
- Document Supabase tier + PITR procedure in `CLAUDE.md` (Q9/10, ~30 min).
- Add `revalidate: 60` to `/admin/overview` (Q42, ~5 min).
- Enable MFA on the one admin account (Q15, ~5 min in Supabase dashboard).

## Real dev work needed (not just copy/config)

- CCPA data export endpoint (Q34).
- Cross-student conflict check at admin-assignment time (Q3).
- Transcript retention job (Q35).
- RLS policy test suite (Q4).
- Isolated staging Supabase project (Q8).
- Build recordings OR strip marketing (Q41, shared with USER_AUDIT Q37).
