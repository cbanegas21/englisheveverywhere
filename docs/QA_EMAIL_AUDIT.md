# EnglishKolab — Transactional Email Audit (2026-06-09)

Full audit of every email the app sends, per Carlos's directive (typos / branding / encoding / formatting / security). 20-agent workflow read each template's real source. **19 Resend emails in the repo + 2 Supabase-dashboard-templated auth emails.** Full per-email detail in the workflow output; this is the actionable consolidation.

## The headline: ~5 cross-cutting fixes resolve the bulk of it

1. **🔴 SECURITY — no HTML-escaping anywhere; ~14 emails interpolate user `full_name`/`email` raw into HTML.** No `escapeHtml`/`sanitize` helper exists in `src/` at all. The dangerous variant is **cross-party**: in booking/reminder emails one user's `full_name` (`counterpartName`) renders unescaped in the *other* party's inbox (`reminders.ts:173-175,194,135`) → stored HTML/markup injection, not just self-XSS.
   - **Fix once:** add `escapeHtml(s)` (`& < > " '`) to `src/lib/email.ts`, export it, wrap every interpolated user value at the sinks; cap `full_name` length/sanitize at the profile-update source.

2. **🟠 BRANDING — the shared `brandedEmail()` wrapper is used by only 1 of 19 emails.** Its own doc says "reuse for all Resend email so they read like one product," but only `auth.ts` (welcome) uses it. Every reminder, confirmation, placement, onboarding, admin-booking, assignment, approval, rejection, and password-reset email hand-rolls bare `<p>`/`<table>` with **no wordmark / card / footer**.
   - **Fix once:** route every body through `brandedEmail({heading, bodyHtml, ctaLabel, ctaUrl, footnote})`. ⚠ `brandedEmail()` drops `heading` raw into `<h1>` — so escape user values *before* passing (pairs with #1).

3. **🟠 DELIVERABILITY — ~16 of 18 emails ship HTML-only (no `text:` part).** Only the welcome email adds a plain-text alternative; the code's own comment (`auth.ts:56`) notes HTML-only mail is spam-penalized.
   - **Fix:** add a `text:` field to every Resend payload (generate from the same copy when migrating to `brandedEmail()`).

4. **🟡 LINKS — `http://localhost:3000` fallback baked into URL builders everywhere** (`auth.ts`, `reminders.ts`, `booking.ts`, `onboarding.ts`, `admin/actions.ts`) — and worst, into the **`.ics`** LOCATION/URL (`reminders.ts:404-406`). Works today because the Vercel env var is set, but a single missing var silently ships dead localhost links to real users.
   - **Fix once:** change the shared fallback to `'https://englishkolab.com'` (or hard-fail when the var is missing in production).

5. **🟡 SENDER — bare `from` address (no display name).** `EMAIL_FROM || 'noreply@englishkolab.com'` shows the raw mailbox as the sender. Domain is correct (no stale "English Everywhere"/`vercel.app`).
   - **Fix:** standardize on `EnglishKolab <noreply@englishkolab.com>`.

## Specific copy / typo findings
- **"Hola ,"** — dangling comma + stray space when no name: `admin/actions.ts:757` `Hola ${name || ''},` → `Hola${name ? ' ' + escapeHtml(name) : ''},`.
- **Raw enum leaked to users** — cancellation email shows `late`/`early`/`no_show_teacher` verbatim in subject + table (`booking.ts:347,351,388,602`) → map to readable labels.
- **ES/EN term mismatch** — student placement confirm says "llamada de diagnóstico" (ES) vs "evaluation call" (EN) (`placement.ts:267-269`) → standardize EN to "placement call".
- **Dash style** — teacher application "24-48" (ES hyphen) vs "24–48" (EN en-dash) (`onboarding.ts:135,143`).
- **Spanish-only in a bilingual app** (product call): teacher-assignment→student (`admin/actions.ts:988-1012`) and teacher-rejection (`admin/actions.ts:850-851`) — thread `lang` & branch, or confirm ES-only is intended.

## Encoding / ASCII
No mojibake found in repo source (templates are UTF-8 clean). The real encoding risk is the **unescaped interpolation (#1)** — that's where malformed/injected user input would corrupt rendering.

## ⚠ Manual Supabase dashboard check needed (NOT in the repo)
Two auth emails are sent by **Supabase's own mailer** (Auth → Email Templates) — agents can't read them; they are **not localized or branded** by our code:
1. **Signup confirmation** — only sent if `mailer_autoconfirm` is OFF (app runs autoconfirm ON today, so normally not sent).
2. **Password recovery** — the self-service `resetPassword()` flow uses Supabase's template.
**Action (Carlos/me, in the dashboard):** review both for ES/EN copy + EnglishKolab branding, and verify **Site URL / Additional Redirect URLs** = `https://englishkolab.com` (not a `*.vercel.app` preview or localhost). The admin-triggered reset (`resetStudentPassword`) is separate — it uses repo HTML via Resend, covered above.

## Recommended fix order
**Batch E1 (one PR, fixes many):** add `escapeHtml` + wrap all sinks (#1) → migrate all emails to `brandedEmail()` (#2) → add `text:` parts (#3) → fix localhost fallback (#4) → name the `from` (#5). **Batch E2:** the specific copy/typo fixes + the ES/EN bilingual calls. **Manual:** the two Supabase templates + Site URL.
