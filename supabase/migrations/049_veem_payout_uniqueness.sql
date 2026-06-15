-- 049_veem_payout_uniqueness.sql
-- §7.4 AUTHZ-01: payout-routing integrity for saveTeacherVeemPayout (ownership was
-- already airtight — self-row only). Two gaps:
--   * No uniqueness on teachers.payout_veem_email — two teachers could register the
--     SAME Veem address (e.g. a typo into someone else's), and the weekly sweep
--     would route one teacher's payout to the other's wallet. Add a partial unique
--     index (nulls allowed; non-null addresses unique).
--   * The new per-user rate-limit on the action needs 'saveTeacherVeemPayout' in the
--     auth_attempts.action allowlist or checkUserActionLimit is a silent no-op
--     (the 036/041 lesson).
create unique index if not exists teachers_payout_veem_email_unique
  on public.teachers (payout_veem_email)
  where payout_veem_email is not null;

alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action = any (array[
    'login','signup','reset','createBooking','bookPlacementCall','reschedulePlacementCall',
    'requestEmailChange','updateStudentProfile','updateTeacherProfile','transcribe',
    'extractVocab','teacherOnboarding','saveTeacherVeemPayout'
  ]));
