-- Lock down sensitive columns on profiles, students, and teachers.
--
-- Why:
--   Prior to this migration, UPDATE policies on these tables used only a
--   USING clause (auth.uid() = profile_id / id) with WITH CHECK = NULL, and
--   no column-level GRANTs were in place. A USING clause restricts WHICH
--   row can be modified but NOT which columns. Result: any authenticated
--   user could directly call
--
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
--     supabase.from('students').update({ classes_remaining: 999 }).eq('profile_id', myId)
--     supabase.from('teachers').update({ is_active: true, hourly_rate: 999 }).eq('profile_id', myId)
--
--   from the browser client (logged-in session) and succeed. This was proven
--   by `tests/e2e/rls-privilege-escalation.spec.ts` — all three probes
--   succeeded against the live DB.
--
--   The failure is compound: RLS was on, the row-level gate was correct, but
--   column-level protection was missing. PostgreSQL supports this via
--   `GRANT UPDATE (col1, col2) ON tbl TO role` — listed columns only.
--
-- What this migration does:
--   1. REVOKE UPDATE (all columns) ON each table FROM authenticated
--   2. GRANT UPDATE (only the safe columns) ON each table TO authenticated
--
--   Server actions that update admin-only columns (addStudentClasses,
--   approveTeacher, setTeacherRate, updateStudentRole, etc) go through the
--   service-role `adminClient` which is NOT affected by these GRANTs.
--
-- Safe-column lists were derived by grepping every `.from('profiles' |
-- 'students' | 'teachers').update(...)` in `src/app/actions/*` that uses the
-- user-session `createClient()` (not `createAdminClient()`).

-- ── profiles ──────────────────────────────────────────────────────────
-- Self-serve writes: display name, locale, contact, notification prefs.
-- NOT writable by user: role, email, id. (email is managed by auth.users.)

REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  full_name,
  timezone,
  phone,
  avatar_url,
  preferred_language,
  preferred_currency,
  notification_preferences,
  updated_at
) ON public.profiles TO authenticated;

-- ── students ──────────────────────────────────────────────────────────
-- Self-serve writes: intake/placement answers, locale. Admin-only:
-- classes_remaining, level, primary_teacher_id, placement_test_done,
-- admin_notes. (intake_done and placement_scheduled stay user-writable —
-- those are part of the guided flow; worst-case exploit is skipping the
-- intake wall, not a financial gain.)

REVOKE UPDATE ON public.students FROM authenticated;

GRANT UPDATE (
  learning_goal,
  work_description,
  learning_style,
  age_range,
  intake_done,
  survey_answers,
  placement_scheduled
) ON public.students TO authenticated;

-- ── teachers ──────────────────────────────────────────────────────────
-- Self-serve writes: bio, specializations, certifications. Admin-only:
-- is_active, hourly_rate, stripe_account_id, total_sessions, admin_notes.
-- Note: updateTeacherProfile currently updates `bio` and `specializations`
-- via the user client — these stay in the GRANT list.

REVOKE UPDATE ON public.teachers FROM authenticated;

GRANT UPDATE (
  bio,
  specializations,
  certifications
) ON public.teachers TO authenticated;

-- ── Verification hint ────────────────────────────────────────────────
-- After applying, re-run tests/e2e/rls-privilege-escalation.spec.ts — all
-- three probes should now fail the UPDATE (error: permission denied for
-- column <col>) and the row should remain unchanged.
