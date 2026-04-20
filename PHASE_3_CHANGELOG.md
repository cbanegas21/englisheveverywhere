# Phase 3 — My Plan + Currency + Settings

Scope: replace hardcoded USD/HNL/MXN with a full ISO-4217 currency system,
rebuild the **My Plan** dashboard page to match Phase 2 visuals, and expand
the **Settings** page from timezone-only into a 5-tab surface
(Profile / Account / Notifications / Billing / Danger Zone).

## Files touched

### New
- `src/lib/currencies.ts` — ~155 ISO 4217 entries (code, name, symbol, flag), `getCurrency()`, `formatAmount()` with K/M suffixes.
- `src/lib/fx.ts` — free `exchangerate.host` client with 24h in-memory + localStorage cache, in-flight dedup, `getRate` / `getCachedRate` / `prefetchRates` / `convertAmount`.
- `src/components/CurrencySelect.tsx` — searchable portal dropdown (keyboard nav: ArrowUp/Down/Enter/Escape), `variant: 'light' | 'dark'`, `compact?` flag. Used in Navbar + PlanClient.
- `src/components/NotificationPreferences.tsx` — extracted from `PlacementScheduledScreen`; two variants (`card` compact stub, `panel` full-width with save). Used in both Placement and Settings with zero duplication.
- `supabase/migrations/014_profile_settings_fields.sql` — adds `profiles.phone`, `profiles.preferred_currency` (3-char ISO check), `profiles.notification_preferences` JSONB with defaults. **Applied to live DB via Supabase Management API.**

### Edited
- `src/lib/useCurrency.ts` — rewritten as a facade over `currencies.ts` + `fx.ts`. Accepts `{ initialCurrency, onPersist }`. Keeps `CURRENCIES` (codes) and `CURRENCY_INFO` exports for back-compat. Lazy localStorage init to satisfy React 19 lint rules.
- `src/lib/pricing.ts` — removed hardcoded `HNL_RATE` constant.
- `src/lib/plans.ts` — simplified to a re-export of `pricing.ts` canonical map.
- `src/app/actions/profile.ts` — `updateStudentProfile` now accepts `phone`, `avatarUrl`, `preferredLanguage`, `preferredCurrency`, `notificationPreferences` (all optional). Added `savePreferredCurrency()` for background persistence from `useCurrency`.
- `src/components/landing/Navbar.tsx` — replaced bespoke currency dropdown with `<CurrencySelect variant="dark" compact />` in desktop + mobile.
- `src/components/landing/Pricing.tsx` — uses `convert()` from `useCurrency` instead of hardcoded FX branch.
- `src/app/[lang]/dashboard/plan/page.tsx` — parallel fetch of `profile.preferred_currency` + latest subscription row (`status`, `current_period_end`), passes to client as `initialCurrency` and `renewalDate`.
- `src/app/[lang]/dashboard/plan/PlanClient.tsx` — full rewrite:
  - `max-w-[1440px]` + `lg:grid-cols-[1fr_340px]` layout.
  - `CurrentPlanHero` with crimson gradient (active plan) or neutral (no plan), stat card (classes remaining), status pill, renewal date, disabled *Manage subscription* CTA + "Próximamente" badge + TODO for Stripe Billing Portal.
  - 4-column plan comparison grid (`sm:grid-cols-2 lg:grid-cols-4`), action variants: current / select / upgrade / downgrade, prices rendered in selected currency.
  - Sidebar: crimson Top-up card scrolling to `#plans` + FAQ accordion (4 Q&A, single-open).
  - Billing history empty state + **TODO (Phase 4): pull from Stripe invoices API**.
  - Preserved existing Add-more-classes + Payment confirmation modals and Success screen.
- `src/app/[lang]/dashboard/placement/PlacementScheduledScreen.tsx` — inline `RemindersCard` replaced with `<NotificationPreferences variant="card" />`; deleted ~50 lines of duplicated UI + icon imports.
- `src/app/[lang]/dashboard/configuracion/page.tsx` — fetches full profile row (phone, avatar_url, preferred_language, preferred_currency, notification_preferences).
- `src/app/[lang]/dashboard/configuracion/ConfigStudentClient.tsx` — full rewrite to tabbed settings (desktop left-nav / mobile horizontal scroll) with 5 sections:
  - **Profile**: avatar (upload disabled + "Próximamente" + TODO), full name, email (readonly), phone.
  - **Account**: password reset link, language toggle (updates cookie + profile + switches route), timezone.
  - **Notifications**: `<NotificationPreferences variant="panel" />` calling `updateStudentProfile({ notificationPreferences })`.
  - **Billing**: link to `/dashboard/plan`.
  - **Danger Zone**: delete button → typed-confirmation modal (`BORRAR` / `DELETE`) + TODO (no endpoint yet).

## Assumptions I made

1. **Avatar upload is stub-only.** No Supabase Storage bucket is provisioned for `avatars/`. UI + button + hint are present but the file input handler is a no-op; button is disabled with "Próximamente" badge. Added TODO in the component + changelog note for Phase 4.
2. **Manage Subscription** is disabled with "Próximamente". We'd need a Stripe Customer Billing Portal session endpoint — not wired yet. TODO comment left in `PlanClient.tsx`.
3. **Billing history** renders an empty state because Stripe keys are placeholder in dev (see `CLAUDE.md` → Stripe). TODO comment references Stripe invoices API for Phase 4.
4. **Delete Account** UI is complete (confirm modal with typed keyword) but the action is disarmed — it closes the modal without calling any server action. TODO in the component; this requires a cascading RLS-safe delete or a Supabase admin function.
5. **Currency persistence** is background-only — `useCurrency` calls `savePreferredCurrency` via `onPersist` so UI never blocks on the DB round-trip. localStorage remains the instant cache.
6. **FX provider**: `exchangerate.host` (free, no key) per the spec. If fetch fails, we fall back to the persisted cache (up to 24h stale) or neutral 1.0 rate; UI still renders the USD amount rather than spinning.
7. **Language switch** in the Account tab persists `preferred_language` to the DB, sets the `ee-locale` cookie + localStorage, and rewrites the current URL's `[lang]` segment. It does not globally reload.
8. The **`Clock` import removal** in `ConfigStudentClient.tsx` was the only cosmetic lint fix — pre-existing `Clock` was used for the timezone label, now that `Field` renders the plain label with no icon, the import is dead.

## Verification

```
npx tsc --noEmit    → EXIT 0 (clean)
pnpm lint           → 64 problems (44 errors, 20 warnings)
                     baseline: 65 / 45 / 20 — net: −1 error, ±0 warnings.
                     Zero new issues in Phase 3 files.
pnpm build          → ✓ compiled; all 61 static pages generated.
```

Pre-existing lint errors live in `actions/stripe.ts`, `actions/video.ts`,
`api/stripe/webhook/route.ts`, `admin/login/LoginStudentClient.tsx`,
`maestro/dashboard/*.tsx` and are unrelated to Phase 3 scope.

## TODOs left for Phase 4

- Stripe Customer Billing Portal session for **Manage subscription** on `/dashboard/plan`.
- Stripe invoices API hookup for **Billing history** table.
- Supabase Storage `avatars/` bucket + RLS policy + upload action for **Profile → Avatar**.
- Cascade-safe **Delete account** server action.
- Reminder delivery cron (queries bookings in next 25h / 2h, fans out via Resend email + Twilio SMS/WhatsApp) — reminder prefs UI is already persisting.
