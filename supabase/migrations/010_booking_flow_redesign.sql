-- ============================================================
-- MIGRATION 010: Student-initiated booking + admin assignment flow
-- ============================================================
-- Students now book any time ≥24h out (gate enforced in code).
-- Teacher assignment for classes + admin-conductor assignment for
-- placement calls both happen admin-side after the booking is created.
-- availability_slots becomes a planning hint for teachers, not a gate
-- on the student booking UI.

-- Normalize legacy 'placement' type value (no-op if none exist)
update public.bookings
  set type = 'placement_test'
  where type = 'placement';

-- Classes + placements can exist before admin assigns
alter table public.bookings
  alter column teacher_id drop not null;

-- Placement calls never semantically carried a teacher; clear legacy rows
update public.bookings
  set teacher_id = null
  where type = 'placement_test';

-- Who conducts a placement call (admin). Null on class bookings.
alter table public.bookings
  add column if not exists conductor_profile_id uuid references public.profiles(id);

-- Continuity hint: the student's usual teacher. Admin sets manually; no
-- auto-assign logic reads this column.
alter table public.students
  add column if not exists primary_teacher_id uuid references public.teachers(id);

-- Shape constraint: a placement call must not carry a teacher_id.
alter table public.bookings
  drop constraint if exists bookings_placement_no_teacher;
alter table public.bookings
  add constraint bookings_placement_no_teacher
    check (type <> 'placement_test' or teacher_id is null);

-- Admin queue indexes
create index if not exists idx_bookings_pending_class_assignment
  on public.bookings (scheduled_at)
  where type = 'class' and teacher_id is null and status <> 'cancelled';

create index if not exists idx_bookings_pending_placement_assignment
  on public.bookings (scheduled_at)
  where type = 'placement_test' and conductor_profile_id is null and status <> 'cancelled';
