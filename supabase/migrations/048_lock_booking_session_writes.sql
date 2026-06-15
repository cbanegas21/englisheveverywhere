-- 048_lock_booking_session_writes.sql
-- §7.4 RLS direct-write sweep. Four browser-reachable holes, same root cause:
--   * "Students can create bookings" (INSERT) let any student REST-insert a
--     confirmed booking with their own student_id and NO credit decrement — a full
--     paywall bypass (free unlimited classes), since the credit is only spent in
--     the createBooking server action.
--   * "Teachers can update booking status" was FOR UPDATE on ALL columns (RLS
--     can't scope columns), so a teacher could REST-set bookings.duration_minutes
--     (completeSession pays rate * duration/60 -> 10x payout) or scheduled_at, etc.
--   * "Teachers can insert/update sessions" let a teacher REST-set
--     sessions.student_joined_at -> fake attendance -> completeSession mints a
--     payout for a class the student never joined (defeats the 045 no-show gate).
-- EVERY legitimate booking/session write goes through the service-role admin
-- client (createBooking / confirm / decline / cancel / reschedule / getRoomAccess /
-- completeSession / admin actions), which BYPASSES RLS — so these per-user write
-- policies were pure, unused attack surface. Drop them (the SELECT policies stay:
-- the student/teacher pages read bookings + sessions via the user client) and
-- revoke the underlying write grants as defense-in-depth (mirrors 016/042).

drop policy if exists "Students can create bookings" on public.bookings;
drop policy if exists "Teachers can update booking status" on public.bookings;
drop policy if exists "Teachers can insert sessions" on public.sessions;
drop policy if exists "Teachers can update sessions" on public.sessions;

revoke insert, update on public.bookings from authenticated, anon;
revoke insert, update on public.sessions from authenticated, anon;
