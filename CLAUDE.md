# CLAUDE.md — technical pointer for English Everywhere

**See [`PROJECT.md`](./PROJECT.md) for product vision, audience, pricing, roles,
and all "why" decisions. This file only covers how the code is put together.**

Last regenerated: 2026-04-17 (updated same day after Batch 4 + cleanup pass).

---

## Stack

- **Next.js 16.2.2** (App Router). This is NOT the Next.js in your training
  data. Breaking changes include: middleware renamed to `proxy.ts`. When in
  doubt, read the relevant guide under `node_modules/next/dist/docs/`.
- **React 19.2.4**, TypeScript 5 (strict), Tailwind v4 (via `@tailwindcss/postcss`).
- **Supabase** (`@supabase/ssr` + `supabase-js`) — RLS enforced; three clients
  in `src/lib/supabase/`: `client.ts` (browser), `server.ts` (SSR cookies),
  `admin.ts` (service role — NEVER expose to browser).
- **LiveKit** — video classroom. `livekit-server-sdk` mints JWTs in
  `src/app/actions/video.ts`; `@livekit/components-react` renders the room.
- **Stripe** — subscription checkout + Connect Express for teacher payouts.
  Dev fallback activates when keys are `*_placeholder`.
- **Resend** — transactional email. Silently no-ops if
  `RESEND_API_KEY === 're_placeholder'`.
- **Anthropic HTTP** (no SDK) — direct `fetch` to `api.anthropic.com/v1/messages`,
  model `claude-haiku-4-5-20251001`, used for post-class AI summaries in
  `actions/video.ts`.
- **Unused deps to remove when convenient:** `@daily-co/daily-js`, `pg`.

## Folder conventions

```
src/
  app/
    page.tsx                   # redirects / → /es
    proxy.ts                   # (actually src/proxy.ts) locale middleware
    layout.tsx                 # root html lang="es"
    [lang]/                    # all user-facing routes — lang ∈ 'es' | 'en'
      (marketing)              # /, /registro, /login, /onboarding, /auth/callback
      dashboard/               # student app
      maestro/                 # teacher app (pending/ gate for unapproved teachers)
      admin/                   # admin CRM (actions.ts guards via assertAdmin)
      sala/[bookingId]/        # LiveKit video room
    api/
      stripe/webhook/          # only HTTP route in the app
    actions/                   # shared server actions (auth, booking, placement,
                               # purchase, stripe, video, profile, intake, onboarding)
  components/
    admin/ dashboard/ landing/ ui/
  lib/
    pricing.ts                 # CANONICAL plan source — spark/drive/ascent/peak
    plans.ts                   # thin re-export of pricing.ts
    i18n/translations.ts       # locales, default 'es'
    supabase/{admin,client,server}.ts
    useCurrency.ts             # 20-currency switcher with FX caching
  types/index.ts               # shared TS types
supabase/
  schema.sql                   # initial schema — CURRENTLY DRIFTED from live DB
  migrations/00{1..7}_*.sql    # additive migrations (see known-broken)
```

- Path alias: `@/*` → `./src/*`.
- All non-API pages live under `/[lang]`. The `src/proxy.ts` enforces this.
- **Routes are in Spanish**: `registro`, `maestros`, `agendar`, `maestro`,
  `sala`, `configuracion`, `disponibilidad`, `ganancias`, etc. Don't rename.
- Server Actions live in two places: shared ones in `src/app/actions/`, admin-
  only ones in `src/app/[lang]/admin/actions.ts`. Be careful —
  `updateStudentProfile` / `updateTeacherProfile` exist in BOTH locations with
  different signatures.

## Run locally

```bash
pnpm install              # always pnpm, never npm
pnpm dev                  # next dev on :3000
pnpm lint
pnpm build
```

No tests exist in the repo.

## Deploy

```bash
git push origin main      # Vercel builds on push. Do NOT run `vercel` CLI.
```

## DB / migration workflow

- **Never run `supabase db reset` or `supabase db push`** — schema.sql is
  drifted from live (see known-broken). Reset would break the live DB.
- **Never tell the user to paste SQL manually.** Apply migrations via the
  Supabase Management API:
  ```
  POST https://api.supabase.com/v1/projects/<PROJECT_REF>/database/query
  Authorization: Bearer <SUPABASE_ACCESS_TOKEN>   # from .env.local
  Body: { "query": "...sql..." }
  ```
- Add new migrations as `supabase/migrations/00N_description.sql` and apply
  them via the API above.
- RLS is ON for every user-data table. Admin writes go through the service-role
  admin client (`src/lib/supabase/admin.ts`) AFTER `assertAdmin()`.

## Coding conventions observed

- Server Actions use `'use server'` + `revalidatePath('/', 'layout')` after
  mutations.
- Auth guard pattern: fetch user from `createClient()` (server), then
  `redirect(`/${lang}/login`)` if null.
- Role-based redirects happen in `actions/auth.ts → signIn`:
  teacher → `/maestro/dashboard`, admin → `/admin`, student → `/dashboard`.
- Teachers are created with `is_active: false`; they land on
  `/[lang]/maestro/pending` until an admin approves via `approveTeacherWithEmail`.
- Emails are always **non-blocking** (fire-and-forget `fetch` / `.catch(() => {})`).
  Never let an email failure break a user action.
- Spanish content formats with `toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })`.
- Booking flow: 24h advance-notice guard in `createBooking`, `decrement_classes`
  on create, `increment_classes` on decline/admin-refund.
- Video room access (`getRoomAccess`) enforces participant-only + 15-min
  early-join / 90-min late-cap. Dev mode short-circuits when LiveKit keys
  are missing.
- Session complete (`completeSession`): updates booking + session rows,
  increments `total_sessions`, writes a `payments` row with the full
  `sessionRate` going to the teacher (`platform_fee_usd = 0` — platform
  margin comes from the subscription/teacher-rate gap, not from the
  per-session payout), then fires `generateSessionSummary` against Claude.

## Known-broken areas (as of 2026-04-17)

1. **`src/app/api/stripe/webhook/route.ts:4-8`** — hardcoded `CLASS_COUNTS` uses
   legacy plan keys (`starter/estandar/intensivo → 4/8/16`). Real keys per
   `src/lib/pricing.ts` are `spark/drive/ascent/peak → 8/12/16/20`. A real
   Stripe purchase will silently fail to credit classes. Deferred until the
   Stripe-account decision is made (see `PROJECT.md` Payments).
2. **`supabase/schema.sql` still drifted** — the initial-state file retains
   the legacy `plans` seed and lacks the columns added in `008_*.sql` +
   `010_*.sql`. Fresh builds end up correct only after running every
   migration in order. Consolidating schema.sql is a low-priority cleanup.

### Resolved on 2026-04-17
- Schema drift back-filled as `008_schema_drift_backfill.sql`.
- Plans re-seeded via `009_plans_reseed.sql` — legacy rows deactivated,
  spark/drive/ascent/peak upserted with `plan_key` unique index.
- Orphan `src/app/[lang` folder deleted.
- Unused deps `@daily-co/daily-js` + `pg` removed.
- 85/15 payments split replaced with 100% teacher take-home.
- **Booking flow redesign** (`010_booking_flow_redesign.sql`) — students book
  any time ≥24h out, teacher_id nullable until admin assigns, placement
  calls track admin-conductor via new `conductor_profile_id` column,
  `students.primary_teacher_id` added as manual continuity hint.
- **Dead `placement_tests` table dropped** (`011_drop_dead_placement_tests.sql`).
- **Namespace collision fixed** — admin-side renamed to
  `adminUpdateStudentProfile` / `adminUpdateTeacherProfile`. Self-edit
  versions in `src/app/actions/profile.ts` keep the original names.
- **`CLAUDE.old.md` deleted** — new pointer has been exercised.

For open product questions, see `/tmp/ee-state.md` (Top-10 questions awaiting
Carlos's answers) — not a permanent file, regenerate on demand.
