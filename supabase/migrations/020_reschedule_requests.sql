-- 020_reschedule_requests.sql
-- Teacher-initiated reschedule-request flow. A teacher cannot move a confirmed
-- class unilaterally; they file a request, admin reviews, admin either approves
-- (booking is moved to the proposed time and status stays 'confirmed') or rejects.
--
-- MVP scope: teacher → admin only. Student-initiated reschedules route through
-- the existing placement-call reschedule path (student app), not this table.

create table if not exists reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  requested_by_role text not null check (requested_by_role in ('teacher','student','admin')),
  original_scheduled_at timestamptz not null,
  proposed_scheduled_at timestamptz not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reschedule_requests_booking_idx on reschedule_requests (booking_id);
create index if not exists reschedule_requests_status_idx on reschedule_requests (status);

-- Only one pending request per booking at a time — blocks duplicate submissions.
create unique index if not exists reschedule_requests_one_pending_per_booking
  on reschedule_requests (booking_id)
  where status = 'pending';

-- RLS
alter table reschedule_requests enable row level security;

-- Teacher can insert a request for their own bookings.
drop policy if exists reschedule_teacher_insert on reschedule_requests;
create policy reschedule_teacher_insert on reschedule_requests
  for insert with check (
    exists (
      select 1 from bookings b
      join teachers t on t.id = b.teacher_id
      where b.id = reschedule_requests.booking_id
        and t.profile_id = auth.uid()
    )
  );

-- Teacher can read their own requests.
drop policy if exists reschedule_teacher_select on reschedule_requests;
create policy reschedule_teacher_select on reschedule_requests
  for select using (
    exists (
      select 1 from bookings b
      join teachers t on t.id = b.teacher_id
      where b.id = reschedule_requests.booking_id
        and t.profile_id = auth.uid()
    )
  );

-- Teacher can cancel (update status='cancelled') their own pending request.
drop policy if exists reschedule_teacher_update on reschedule_requests;
create policy reschedule_teacher_update on reschedule_requests
  for update using (
    exists (
      select 1 from bookings b
      join teachers t on t.id = b.teacher_id
      where b.id = reschedule_requests.booking_id
        and t.profile_id = auth.uid()
    )
  );

-- Student can read requests for their own bookings (visibility only).
drop policy if exists reschedule_student_select on reschedule_requests;
create policy reschedule_student_select on reschedule_requests
  for select using (
    exists (
      select 1 from bookings b
      join students s on s.id = b.student_id
      where b.id = reschedule_requests.booking_id
        and s.profile_id = auth.uid()
    )
  );

-- Admin: server-side admin client bypasses RLS, but keep an explicit policy for
-- clarity and future-proofing if admin reads ever move to the SSR client.
drop policy if exists reschedule_admin_all on reschedule_requests;
create policy reschedule_admin_all on reschedule_requests
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- updated_at trigger
create or replace function set_reschedule_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reschedule_requests_updated_at on reschedule_requests;
create trigger trg_reschedule_requests_updated_at
  before update on reschedule_requests
  for each row execute function set_reschedule_requests_updated_at();
