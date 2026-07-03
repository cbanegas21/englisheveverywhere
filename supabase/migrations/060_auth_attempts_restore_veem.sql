-- 060_auth_attempts_restore_veem.sql
-- Deep-audit OPS-1. Migration 058 re-created auth_attempts_action_check but
-- dropped 'saveTeacherVeemPayout' (added by 049), despite its "additive only"
-- comment — silently disabling the rate limit on the teacher payout-routing
-- action: checkUserActionLimit inserts into auth_attempts, the CHECK rejects the
-- unknown action, and the limiter (failClosed=false) returns ok:true every time,
-- so saveTeacherVeemPayout became un-throttled (email churn + a Veem-email
-- enumeration oracle via the 23505 response). Re-add it. This is now the COMPLETE
-- allowlist verified against every checkUserActionLimit call site in the code
-- (2026-07-03) plus the login/signup/reset auth actions.

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
    'saveTeacherVeemPayout'::text,
    'transcribe'::text,
    'extractVocab'::text,
    'teacherOnboarding'::text,
    'uploadLabFile'::text,
    'attachAssignmentFile'::text
  ]));
