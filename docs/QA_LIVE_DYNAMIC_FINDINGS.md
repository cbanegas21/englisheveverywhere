# EnglishKolab — Live / Dynamic QA Findings

Dynamic QA round started **2026-06-09** (ultracode). This is the **dynamic** half of the QA process (drive the real running app), complementing the **static** audit in `QA_ENTERPRISE_FINDINGS.md` + `_TOPUP.md`. See `feedback-qa-process-definition` (memory) for the standard: every possibility / every "what-if" on every surface, run against the real app.

- **Target:** `https://englishkolab.com` (live, pre-launch — only throwaway data on the DB)
- **Accounts:** the 3 canonical QA logins (`admin@`/`teacher@`/`student@englishkolab.com`)
- **Harness:** existing Playwright suite (`tests/e2e/`), `PLAYWRIGHT_BASE_URL` → live, no `E2E_PROVISION` (zero provisioning side-effects)

---

## Run log

### Baseline — existing 124-test suite vs LIVE (2026-06-09)
`--workers=2`, 15.6 min. **71 passed · 10 failed · 38 skipped (login-gated `test.skip`) · 5 did not run.**

#### Triage of the 10 failures (11-agent workflow `triage-baseline-failures`): **1 real bug, 9 test artifacts**

| Test | Verdict | Sev | Root cause |
|---|---|---|---|
| `admin-booking-assign.spec.ts:69` | **real-bug** | **high** | Prod redacts thrown Server Action errors to a digest; override UX string-matches `e.message` for "not available", so "Assign anyway?" never fires. |
| `admin-placement-schedule.spec.ts:67` | test-artifact | — | `/es` route, hardcoded EN selector "Schedule a call" (real: "Agendar una llamada"). |
| `admin-refund.spec.ts:50` | test-artifact | — | `/es` waits for EN "Overview" tab (real: "Resumen"). |
| `admin-refund.spec.ts:97` | test-artifact | — | Same EN "Overview" selector on `/es`. |
| `admin-teacher-approval.spec.ts:76` | test-artifact | — | `/es` waits for EN "Pending Applications"/"Approve" (real: "Solicitudes pendientes"/"Aprobar"). |
| `auth-ui.spec.ts:100` | test-artifact | low | Suite-wide single-IP login flood tripped the per-IP rate limiter → "Demasiados intentos". |
| `booking.spec.ts:92` | test-artifact | low | Reuses shared `studentPage` without re-auth; stale session → `/login`. |
| `booking.spec.ts:129` | test-artifact | — | Shared `teacherPage` session lapsed (rate-limit) → `/login`. |
| `booking.spec.ts:162` | test-artifact | — | Same lost `teacherPage` session → `/login`. |
| `password-reset.spec.ts:107` | test-artifact | — | Heading regex typo: asserts "Restablece**r** contraseña"; page renders "Restablece tu contraseña". |

---

## Confirmed LIVE bugs (dynamic round)

### LIVE-001 · [HIGH] · Admin "Assign anyway?" override is unreachable in production
- **Where:** `assignAndConfirmBooking` (admin actions) consumed by `BookingAssign.tsx` + `BookingCalendarClient.tsx:207` (drag-drop + detail-panel paths).
- **Cause:** the action `throw`s on a soft conflict (teacher not available / not the primary teacher); the UI decides whether to show the "Assign anyway?" override by **string-matching `e.message`**. Production **redacts thrown Server Action errors to an opaque digest**, so the match fails and the override prompt never appears → off-hours / no-availability assignments silently strand the pending booking.
- **⭐ PROD-ONLY:** invisible in local dev (dev returns the full error text). Local QA passes it green — caught only by running against live.
- **Fix direction:** return a structured result `{ ok:false, reason:'not_available'|'primary_teacher', message }` instead of `throw`; branch the UI on `reason` (not on `e.message`). Apply to all three call paths.

---

### Exhaustive AUTH pilot — 14 probes vs LIVE (2026-06-09)
`tests/e2e/exhaustive-auth.spec.ts`, serial, with on-demand `auth_attempts` reset so our own run never self-blocks. 9 passed / 5 asserted-failures → triaged to **3 real findings, 2 reassuring disproofs, 3 of my own test artifacts**.

**Confirmed LIVE findings**
- **LIVE-002 · [MEDIUM] · Password reset has no rate limit.** `/es/login/reset` accepted 8/8 rapid submits, always rendering the success screen. `resetPassword` (auth.ts:224) calls no `checkAuthRateLimit`. Vector: inbox-spam a known user + drain the Supabase recovery-email quota. Fix: add a `reset` action key to `checkAuthRateLimit`, mirroring login/signup.
- **LIVE-003 · [LOW] · Logged-in user revisiting `/login` is shown the form.** The login page is a pure client component with no auth-aware redirect; an authenticated user sees the login form instead of being sent to their role home. Fix: server-side session check (or client redirect) on login/registro.
- **LIVE-004 · [LOW] · "Keep me logged in" is decorative.** Checkbox has no `name` (login/page.tsx:197) → never submitted, no session-persistence wiring. Fix: wire it (cookie maxAge) or remove it. (Confirms the static finding, live.)

**Reassuring — verified SAFE on live (these clear/downgrade static-audit fears)**
- **Privilege-escalation fix HOLDS:** signup POST with `role=admin` injected → user created as **student** (auth.ts:78 coercion works in prod).
- **Admin guard bounces students:** student logging in with `?next=/es/admin` lands on their **student dashboard**, not admin (verified by screenshot — URL briefly read `/es/admin` mid-redirect; rendered content was the student dashboard). NOT a breach.
- **XFF rate-limit bypass is platform-mitigated:** the limiter tripped on the real IP AND a spoofed `X-Forwarded-For` did **not** bypass it through Vercel's edge. The static "HIGH" is a code smell, **not exploitable in production** → re-rate to defense-in-depth (still worth hardening the code).
- **Open-redirect:** all 6 `next=` vectors (`//evil`, `/\evil`, `http://evil`, `javascript:`, `/fr/x`, `englishkolab.com.evil.com`) neutralized by `safeNext`.
- **SQLi / XSS** in login fields fail closed — no auth, no 5xx, no script execution.

**My test artifacts (fixed/noted — not app bugs)**
- A2 asserted on a 2s URL snapshot that caught a mid-redirect frame → rewritten to assert on rendered content.
- F2 (double-submit) hit the 60s test timeout → simplified to a cookie check.
- E1 didn't reproduce the raw-error leak via the malformed-email vector → the login error path may be better-behaved than the static audit implied; needs a different trigger to confirm or refute.

## Operational learnings (these shape the exhaustive sweep)

1. **Rate limiter engages and will fight a naive sweep.** 124 tests from one IP tripped the 10-login / 15-min per-IP limiter and cascaded into the shared-session failures. The limiter genuinely works (partial answer to the "5× wrong password / lockout" question) — but the sweep must: **(a)** log in once per role and **reuse the session** (`storageState`), not re-login per test; **(b)** run deliberate rate-limit/lockout probes **last**, since they exhaust the limiter for ~15 min. Do NOT relax the prod limit; if needed, exempt trusted traffic via a shared header/secret.
2. **Locale.** The app defaults to `/es`; the existing admin specs hardcode English accessible names. Every new exhaustive spec must be **locale-aware** (prefer `data-testid`, or match per-locale labels), and cover **both** ES + EN.

## Existing test-suite repairs (so future live runs are trustworthy — parallel cleanup, not blocking)
- Locale-aware selectors: `admin-placement-schedule`, `admin-refund` (×2), `admin-teacher-approval` (and delete the stale "Admin UI is English-only" comment, `:90`).
- Shared-session re-auth: `booking.spec.ts` (92/129/162) — wire the dead `ensureLoggedIn` guard (38-44) or adopt `storageState`; stop using the admin email `c.banegaspaz2020@gmail.com` as the "teacher" owner.
- Regex typo: `password-reset.spec.ts:113` → `/Restablece.*contraseña/i`.
- Re-run the rate-limit-cascade failures after the session-reuse fix before trusting them.

---

## Full 24-surface sweep — VERDICT (2026-06-09)

> **UPDATE — cluster #1 + 3 mediums SHIPPED & VERIFIED (commit `47f0693`, migration 030 applied, CI green):** LIVE-S01 (weekStart no-500), S03 (availability times), S11 (assignments render) confirmed live by `tests/e2e/verify-fixes.spec.ts` ✅; S02 (toggle grant), S04 (reset limiter), S12/S13 (profile validation) fixed + verified-by-construction. **Remaining:** LIVE-S05..S10 lows, Email Batch E1 (branding/text/from/escaping sweep), static Batch-1 security, features (WhatsApp toggle+admin view, receipts), test-suite repairs.
526 probes authored across all 24 surfaces → 618 tests, run live in 2 phases (Phase 1 non-mutating parallel, Phase 2 mutating serial). **145 failures triaged (25-agent adversarial workflow) → only ~11 real bugs, ZERO critical, ZERO high.** The app is healthy. The bulk of failures were **test-infra, not the app**: a stale QA session that expired during the 1.4h serial run bounced ~80 tests to `/login`, anonymous-context session bleed (~9), and over-strict/inverted/locator assertions (~10+).

### Confirmed real bugs (none critical/high) — 4 medium, rest low
| ID | Surface | Sev | Bug | Fix |
|---|---|---|---|---|
| LIVE-S01 | Admin bookings (`?weekStart=`) | **med** | Garbage `?weekStart` → unhandled Invalid Date → 500 error boundary (admin self-DoS). Not reflected (no XSS). | Validate parsed date; fall back to current week. |
| LIVE-S02 | Teacher "Accepting students" toggle | **med** | Silent 403 — migration 028 added `accepting_students` but never added it to the locked `GRANT UPDATE` allowlist from 016; UI flips optimistically with no error check, reverts on reload. Teacher can never toggle it. **Confirms the static-audit finding.** | Migration `GRANT UPDATE (accepting_students) … TO authenticated` + handle the error in `toggleActive()`. |
| LIVE-S03 | Teacher availability (disponibilidad) | **med** | Times saved `'HH:MM'` normalize to `'HH:MM:SS'` in PG `time`; on reload no `<select>` option matches → fields reset to `00:00` (looks like data loss). | Trim seconds on read (`start_time.slice(0,5)`). |
| LIVE-S04 | Password reset | **med** | `resetPassword()` omits `checkAuthRateLimit` → no throttle → inbox-spam / email-quota-drain (8/8 rapid accepted). | Add a `reset` limiter (3-5/15min); still redirect generic. |
| LIVE-S05 | Admin overview/tables (cross-cutting) | low | `toLocaleString` without explicit `timeZone` → SSR(UTC) vs client hydration mismatch (React #418), console noise. | Pass `{ timeZone: 'America/Tegucigalpa' }`. |
| LIVE-S06 | Admin library + bookings calendar (cross-cutting) | low | Hardcoded English on `/es` (kicker, upload errors, whole calendar chrome). Admin-only. | Move strings into `t[lang]`. |
| LIVE-S07 | Teacher availability copy | low | Falsely claims students self-book the windows (admin assigns). Misleading. | Reword ES+EN. |
| LIVE-S08 | Teacher availability summary | low | `"1 slots"` not pluralized + ES shows English "slots". | Use the existing pluralizer. |
| LIVE-S09 | Login (already authed) | low | Logged-in user revisiting `/login` sees the form (no redirect). | Auth check on the login route → role home. |
| LIVE-S10 | Login "Keep me logged in" | low | Decorative checkbox (no `name`, never read). | Wire it or remove it. |

### Cross-cutting themes
i18n hardcoded-English on `/es` (per-component literals vs `t[lang]`) · SSR date formatting without `timeZone` → hydration mismatch · silent optimistic client writes mask RLS 403s · column-grant drift (new writable columns not added to the 016 `GRANT` allowlist) · auth-action rate-limit parity (reset missed).

### Coverage gap — CLOSED (re-run 2026-06-09) — ⚠ updates the headline counts above
Re-minted sessions + re-ran the 4 specs → **64 passed / 26 failed → triaged: 5 real bugs, 21 test artifacts.** Session-expiry caused the ~80 earlier bounces (test-infra, not the app). **This re-run surfaced 1 HIGH the bounced run had hidden — so the corrected sweep total is ~14 real bugs: 0 critical, 1 high, ~6 medium, ~7 low.** New real bugs:
- **LIVE-S11 · [HIGH] · Student assignments never render their submission** (`dashboard/tareas/page.tsx:41`): the `submission` to-one embed is mis-indexed (`a.submission?.[0]` on an object → always `undefined`), so every assignment renders `submission:null`. Submitted work stays "ABIERTA" / Completadas stays 0, and a GRADED assignment shows an editable textarea + "Enviar" instead of the read-only graded view with the teacher's feedback. DB integrity holds (server blocks the write, `assignments.ts:123-125`) but the UI is broken. **One-line fix:** `const sub = Array.isArray(a.submission) ? a.submission[0] : a.submission` — the sibling `teacher` embed already does this.
- **LIVE-S12 · [MEDIUM] · Profile name stored-XSS / no length cap** (`actions/profile.ts:36`): `updateStudentProfile` writes `full_name` via the service-role (RLS-bypassing) client with no sanitization or length cap — a 634-char `<img src=x onerror=alert(1)>` persisted verbatim. Trim + max-length (~120) + reject `<`/`>`; same for `phone`. Pairs with the email `escapeHtml` fix (`QA_EMAIL_AUDIT.md`).
- **LIVE-S13 · [LOW] · Empty display name accepted** (`actions/profile.ts:36`): blank `full_name` saves as `''`. Require non-empty.

Still UNVERIFIED (blocked by a test-artifact, code-review benign): placement timezone-persistence proof + plan currency-injection — fix the test locators to confirm. Test-suite repairs needed for trustworthy re-runs: anonymous-context isolation, the `button:has(.fi)` selector colliding with the sidebar language toggle, and the `md:hidden` mobile-pill trap.

### Test-suite repairs (so re-runs are trustworthy — not app bugs)
Re-mint `.auth/*.json` with a real refresh token + add `retries` + a pre-flight auth smoke check (fixes ~80) · anonymous-context isolation `storageState:{cookies:[],origins:[]}` (~9) · non-exact/unscoped locators (~6) · inverted "expected-finding" assertions (~4) · onboarding interstitial-race waits (3) · over-strict regex/mobile-viewport (~several).
