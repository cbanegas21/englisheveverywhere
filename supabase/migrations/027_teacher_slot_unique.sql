-- 027_teacher_slot_unique.sql
-- DB-level backstop against teacher double-booking.
--
-- The app already guards this at admin-assignment time via teacherHasConflict()
-- in src/app/[lang]/admin/actions.ts, but that is a read-then-write check and
-- cannot defend against a concurrent assign (TOCTOU). This partial unique index
-- makes the database itself the source of truth: a given teacher can hold at
-- most one CONFIRMED booking at any exact start time.
--
-- Scope notes:
--  * WHERE teacher_id IS NOT NULL — pending bookings (teacher_id null) and
--    placement_test rows (forced null by bookings_placement_no_teacher) are
--    excluded, so two students may still RESERVE the same wall-clock slot;
--    the conflict only materialises once admin confirms a teacher onto it.
--  * status = 'confirmed' — cancelled/completed rows never block a new booking.
--
-- Mirrors the existing student-side guard bookings_student_time_unique.
--
-- ⚠️ Apply only after confirming no existing duplicates:
--   SELECT teacher_id, scheduled_at, count(*)
--   FROM bookings
--   WHERE status = 'confirmed' AND teacher_id IS NOT NULL
--   GROUP BY 1,2 HAVING count(*) > 1;
-- Index creation will fail if any group above returns rows.

CREATE UNIQUE INDEX IF NOT EXISTS bookings_teacher_time_unique
  ON public.bookings (teacher_id, scheduled_at)
  WHERE (status = 'confirmed' AND teacher_id IS NOT NULL);
