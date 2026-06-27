-- The Lab — protect the per-question grading detail from direct REST reads
-- (GRADE-OUTCOME-LEAK). lab_quiz_attempts.questions_snapshot carries per-question
-- `outcome` (correct/incorrect/pending) and `answers` holds the student's own
-- answers. When a quiz has review-after OFF, a student could SELECT their own attempt
-- row via PostgREST and combine outcome + own-answer to reconstruct a binary key, then
-- use the new retake path to score 100% — defeating the teacher's reviewAfter=false
-- control. The app NEVER reads these columns from the browser (every read of
-- lab_quiz_attempts is server-side via the service-role admin client, which bypasses
-- column grants), so we revoke them from the public roles.
--
-- Row visibility (the SELECT RLS policies) is unchanged — a student can still see
-- their own attempt's SCORE columns; only the raw snapshot + answers blobs are hidden.
-- The RSC payload vector is closed separately in the player page (no per-question
-- outcomes/answers shipped when reviewAfter=false). Credit-neutral.

revoke select on public.lab_quiz_attempts from anon, authenticated;
grant select (
  id, assignment_id, attempt_number, auto_score, max_score,
  teacher_feedback, manual_adjusted, submitted_at, graded_at
) on public.lab_quiz_attempts to anon, authenticated;
