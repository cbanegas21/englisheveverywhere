-- 041: expand the auth_attempts.action allowlist.
--
-- The application now rate-limits four more actions via checkUserActionLimit():
--   updateStudentProfile  (student profile edits, DASH-07)
--   transcribe            (live-classroom Deepgram calls, video-6)
--   extractVocab          (live-classroom Anthropic calls, video-6)
--   teacherOnboarding     (CV re-upload abuse guard)
-- but the CHECK constraint (last set by migration 036) didn't list them, so each
-- throttle INSERT was silently rejected — leaving those limiters a no-op (the exact
-- failure mode migration 036 warned about). This re-adds the constraint with the
-- full set. Additive only: every previously-allowed value remains allowed, so no
-- existing row can violate it.

ALTER TABLE public.auth_attempts DROP CONSTRAINT IF EXISTS auth_attempts_action_check;

ALTER TABLE public.auth_attempts ADD CONSTRAINT auth_attempts_action_check
  CHECK (action = ANY (ARRAY[
    'login'::text,
    'signup'::text,
    'reset'::text,
    'createBooking'::text,
    'bookPlacementCall'::text,
    'requestEmailChange'::text,
    'updateStudentProfile'::text,
    'transcribe'::text,
    'extractVocab'::text,
    'teacherOnboarding'::text
  ]));
