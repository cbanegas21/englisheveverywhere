-- 059_lock_students_writes.sql
-- CRITICAL paywall bypass (deep-audit RLS-1, empirically proven 2026-07-03).
-- The "Students can insert own record" INSERT policy + the INSERT table grant
-- let any logged-in student POST directly to /rest/v1/students with their own
-- profile_id and an ARBITRARY classes_remaining — minting unlimited free class
-- credits. The policy only checks auth.uid() = profile_id, never the columns
-- (RLS can't scope columns), and migration 016 only revoked UPDATE on this
-- table, never INSERT. Proven live: a fresh confirmed user (no students row yet,
-- the mid-onboarding window) inserted {profile_id, classes_remaining: 999} and
-- got HTTP 201; completeStudentOnboarding upserts onConflict:profile_id WITHOUT
-- resetting classes_remaining, so the 999 credits persist -> 999 free classes.
--
-- EVERY legitimate students write goes through the service-role admin client
-- (completeStudentOnboarding + saveIntake self-provision via createAdminClient;
-- all admin/booking updates too), which BYPASSES RLS — so these per-user write
-- policies + grants are pure, unused attack surface. Drop them, revoke the write
-- grants. The SELECT policies stay (the student reads its own row via the user
-- client; teachers read intake). Mirrors migration 048 for bookings/sessions.
--
-- Note: UPDATE was already blocked (no UPDATE grant to authenticated → 42501,
-- verified), but the "Students can update own record" policy is now-dead surface
-- — drop it too so a future re-grant can't silently re-open a self-top-up hole.

drop policy if exists "Students can insert own record" on public.students;
drop policy if exists "Students can update own record" on public.students;

revoke insert, update, delete, truncate, references, trigger
  on public.students from authenticated, anon;
