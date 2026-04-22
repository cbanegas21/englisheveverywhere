-- 025_booking_cancellation_audit.sql
-- Audit fields on bookings for who cancelled and why. Lets the student-cancel /
-- student-reschedule / report-no-show flows record *why* a booking was killed,
-- so refund eligibility + admin review is deterministic instead of inferred.

alter table bookings
  add column if not exists cancelled_by text
    check (cancelled_by in ('student','teacher','admin','system'));

alter table bookings
  add column if not exists cancellation_reason text
    check (cancellation_reason in (
      'early',             -- student cancelled >24h before start (credit restored)
      'late',              -- student cancelled <24h before start (credit forfeit)
      'no_show_teacher',   -- student reported teacher never joined (credit restored)
      'no_show_student',   -- teacher reported student never joined
      'teacher_decline',   -- teacher declined a pending assignment
      'admin_refund',      -- admin cancelled + refunded
      'other'
    ));

alter table bookings
  add column if not exists cancelled_at timestamptz;

-- Student RLS for reschedule_requests — the migration that created the table
-- only covered teacher insert/select/update. MVP adds student initiation so
-- students can propose a new time when the current one stops working.

drop policy if exists reschedule_student_insert on reschedule_requests;
create policy reschedule_student_insert on reschedule_requests
  for insert with check (
    exists (
      select 1 from bookings b
      join students s on s.id = b.student_id
      where b.id = reschedule_requests.booking_id
        and s.profile_id = auth.uid()
    )
  );

drop policy if exists reschedule_student_update on reschedule_requests;
create policy reschedule_student_update on reschedule_requests
  for update using (
    exists (
      select 1 from bookings b
      join students s on s.id = b.student_id
      where b.id = reschedule_requests.booking_id
        and s.profile_id = auth.uid()
    )
  );
