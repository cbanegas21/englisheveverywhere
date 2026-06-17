# Launch ops — manual / dashboard steps

Things that can't be done in code and need Carlos to action in a dashboard.
Created 2026-06-01 alongside the launch-readiness work.

## 1. Enable admin MFA — DEFERRED by Carlos (2026-06-02)

**Decision:** not a launch blocker for the initial soft launch; revisit
post-launch. Accepted risk: a leaked admin password has no second factor, so a
compromised admin login = full platform access. Low traffic at launch makes this
acceptable for now. Steps below for when you're ready (≈5 min):

A leaked admin password currently owns the whole platform. Enable TOTP MFA:

1. Supabase dashboard → **Authentication → Providers / Multi-Factor** → ensure
   **TOTP (Authenticator app)** is enabled for the project.
2. Log in to EnglishKolab as `admin@englishkolab.com`, go to account security,
   and enroll an authenticator app (Google Authenticator / 1Password / Authy).
3. Store the recovery codes somewhere safe (password manager).

> Note: Supabase MFA is per-user enrollment. There's no server-side "force MFA
> for role=admin" toggle today, so the safeguard is: enroll the admin account
> and don't skip it. If we add more admins later, enroll each.

## 2. Apply migration 027 (teacher-slot unique index)

✅ **APPLIED 2026-06-01.** `bookings_teacher_time_unique` exists in prod;
duplicate-check returned 0 groups (of 20 confirmed bookings) before applying.
`schema.sql` + `src/types/supabase.ts` regenerated. Kept below for reference /
disaster recovery.

`supabase/migrations/027_teacher_slot_unique.sql` is a DB backstop against
teacher double-booking.

Before applying, check for existing duplicates (the index creation fails if any
exist):

```sql
SELECT teacher_id, scheduled_at, count(*)
FROM bookings
WHERE status = 'confirmed' AND teacher_id IS NOT NULL
GROUP BY 1,2 HAVING count(*) > 1;
```

If that returns no rows, apply via the Management API (per CLAUDE.md — never
paste SQL by hand, never `supabase db push`):

```
POST https://api.supabase.com/v1/projects/<PROJECT_REF>/database/query
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Body: { "query": "<contents of 027_teacher_slot_unique.sql>" }
```

Then refresh generated artifacts: `pnpm gen-types` + `pnpm dump-schema`.

## 3. GitHub secrets for the purge workflow

`.github/workflows/purge-transcripts.yml` needs these repo secrets (same ones CI
already uses): `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`. If they're
already set for the schema-drift job, nothing to do. The workflow skips cleanly
if the token is missing.

## 4. Staging Supabase — ✅ DONE (2026-06-17)

Vercel preview deploys now point at a dedicated **staging** Supabase project, so
a preview-branch migration/seed can no longer clobber prod data.

- **Staging project:** `englishkolab-staging` · ref `enbijetqbfoargwvaqez` ·
  us-east-1 · org `cbanegas`. Schema replicated from `supabase/schema.sql`
  (17 tables / 12 functions / 35 policies + FKs/indexes/RLS/triggers).
- **Vercel env split by target** (production untouched):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` → **preview** = staging, **production+development** = prod.
  - `RESEND_API_KEY` = `re_placeholder` and `STRIPE_SECRET_KEY` =
    `sk_test_placeholder` on **preview** only → previews can't send real email
    or take real charges. (LiveKit/Google left at prod values — ephemeral /
    domain-bound, no persistent side-effect.)
- **Verified:** a staging-only user (absent from prod) logged into a real
  preview deploy and reached `/dashboard`.
- ⚠ **Keep staging in sync:** whenever a migration is applied to prod
  (`kasuwdltupqpfxvjrmrp`), apply the same SQL to staging
  (`enbijetqbfoargwvaqez`) via the Management API query endpoint.
- ℹ Preview deploys are SSO-protected (`ssoProtection: all_except_custom_domains`)
  — only team members can view them; the prod custom domain stays public.
- ⚠ Staging is on the **free** tier and auto-pauses after ~7 days of inactivity;
  if a preview fails to reach it, un-pause `enbijetqbfoargwvaqez` in the Supabase
  dashboard (or via the Management API) and redeploy the preview.
