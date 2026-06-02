# Launch ops — manual / dashboard steps

Things that can't be done in code and need Carlos to action in a dashboard.
Created 2026-06-01 alongside the launch-readiness work.

## 1. Enable admin MFA (do before launch)

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

## 4. Staging Supabase (recommended, larger task)

Vercel preview deploys currently point at the **production** Supabase, so a
preview-branch migration/seed could clobber prod data. Recommended: create a
separate Supabase project for staging and point preview env vars at it. Larger
ops task — not scripted.
