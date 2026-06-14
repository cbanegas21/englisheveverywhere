-- 047_auth_attempts_update_teacher.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow).
--
-- updateTeacherProfile now rate-limits via checkUserActionLimit(user,'updateTeacherProfile',30)
-- (parity with updateStudentProfile). That limiter INSERTs into auth_attempts,
-- which is silently rejected — and the limit becomes a no-op — unless the action
-- is in the CHECK allowlist (the exact failure mode migrations 036/041/044 warned
-- about). Re-add the constraint with 'updateTeacherProfile' included. Additive only:
-- every previously-allowed value remains allowed.

ALTER TABLE public.auth_attempts DROP CONSTRAINT IF EXISTS auth_attempts_action_check;

ALTER TABLE public.auth_attempts ADD CONSTRAINT auth_attempts_action_check
  CHECK (action = ANY (ARRAY[
    'login'::text,
    'signup'::text,
    'reset'::text,
    'createBooking'::text,
    'bookPlacementCall'::text,
    'reschedulePlacementCall'::text,
    'requestEmailChange'::text,
    'updateStudentProfile'::text,
    'updateTeacherProfile'::text,
    'transcribe'::text,
    'extractVocab'::text,
    'teacherOnboarding'::text
  ]));
