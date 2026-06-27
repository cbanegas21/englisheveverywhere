-- The Lab — multi-attempt quizzes (PLAN-01).
-- "retake always allowed" is a gentle/anti-IA product constraint (THE_LAB_PLAN.md
-- line 30). The P1 schema enforced ONE attempt per assignment (UNIQUE on
-- assignment_id), which contradicted that and made the teacher's attempts_allowed
-- + grading_method controls inert. This migration lets a student attempt up to the
-- quiz's attempts_allowed; the grading_method (greatest/average/first/last) picks
-- the official score at read time (src/lib/lab/grading.ts aggregateAttempts).
--
-- Additive + safe: existing attempts keep attempt_number=1 and stay unique under
-- the new composite key. SELECT-only RLS posture is unchanged (no write policies —
-- writes go through the service-role admin client after a gate; the 048 lesson).

-- 1. Drop the single-attempt UNIQUE (auto-named *_assignment_id_key).
alter table public.lab_quiz_attempts
  drop constraint if exists lab_quiz_attempts_assignment_id_key;

-- 2. Ordinal per assignment (1-based). Existing rows default to 1.
alter table public.lab_quiz_attempts
  add column if not exists attempt_number integer not null default 1;

-- 3. Keep attempts well-ordered + race-safe: no two attempts share a number for
--    the same assignment (the new concurrency guard, replacing the old UNIQUE).
alter table public.lab_quiz_attempts
  drop constraint if exists lab_quiz_attempts_assignment_attempt_key;
alter table public.lab_quiz_attempts
  add constraint lab_quiz_attempts_assignment_attempt_key
  unique (assignment_id, attempt_number);
