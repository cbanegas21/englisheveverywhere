-- 045_session_student_attendance.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow), then
-- run `pnpm gen-types` + `pnpm dump-schema`.
--
-- Attendance-gated teacher payout (Classroom QA, 2026-06-13). completeSession's
-- only time gate was "not before scheduled_at", so a teacher could let the clock
-- hit the start time and instantly End Class with the student NEVER present and
-- still mint a full payout + total_sessions++ (confirmed live). We now stamp the
-- session the FIRST time the student successfully opens the room (getRoomAccess
-- with user.id === student.profile_id), and completeSession withholds the payout
-- + session-count when this is NULL — the class still closes, the teacher just
-- isn't paid for a no-show. Additive, nullable; existing rows are unaffected.

alter table public.sessions
  add column if not exists student_joined_at timestamptz;
