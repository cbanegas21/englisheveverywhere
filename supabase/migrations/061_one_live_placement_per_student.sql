-- 061_one_live_placement_per_student.sql
-- Deep-audit RACE-4. bookPlacementCall's duplicate-placement guard is a
-- check-then-insert with no DB backstop, so two concurrent calls at different
-- slots both pass the pre-check and insert — leaving a student with two live
-- placement (diagnostic) bookings + double admin emails. No money (placement is
-- free), but it corrupts the "one diagnostic call per student" invariant.
-- A partial unique index enforces at most ONE live (pending/confirmed) placement
-- per student at the DB layer; the app now surfaces the 23505 as a clean
-- "already scheduled" message. Verified 0 existing violators before applying.

create unique index if not exists bookings_one_live_placement_per_student
  on public.bookings (student_id)
  where type = 'placement_test' and status in ('pending', 'confirmed');
