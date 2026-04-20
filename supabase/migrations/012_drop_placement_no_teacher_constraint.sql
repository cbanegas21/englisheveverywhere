-- Placement calls are conducted by teachers, identical to class bookings.
-- The previous constraint (added in 010) forbade teacher_id on placement_test
-- rows because we briefly modeled placements as admin-conducted via
-- conductor_profile_id. That design was reverted: admins assign a teacher to
-- placement bookings using the same flow as class bookings.

alter table public.bookings
  drop constraint if exists bookings_placement_no_teacher;
