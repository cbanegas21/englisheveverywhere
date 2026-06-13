-- 044_auth_attempts_reschedule_placement.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow).
--
-- reschedulePlacementCall was the one placement path with no rate limit
-- (bookPlacementCall is capped 5/15min) — a scripted student could loop
-- cancel+insert+admin-email unbounded (PL-RL-RESCHED-01). It now calls
-- checkUserActionLimit(user.id, 'reschedulePlacementCall', 5); that limiter
-- INSERTs into auth_attempts, which is silently rejected (and the limit becomes a
-- no-op) unless the action is in the CHECK allowlist — the exact failure mode
-- migrations 036/041 warned about. Re-add the constraint with this action included.
-- Additive only: every previously-allowed value remains allowed.

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
    'transcribe'::text,
    'extractVocab'::text,
    'teacherOnboarding'::text
  ]));
