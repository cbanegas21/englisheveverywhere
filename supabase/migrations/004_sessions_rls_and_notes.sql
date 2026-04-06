-- Add live teacher notes column to sessions
alter table public.sessions add column if not exists notes text;

-- Teachers can insert sessions for bookings they are assigned to
create policy "Teachers can insert sessions"
  on public.sessions for insert
  with check (
    exists (
      select 1 from public.bookings b
      join public.teachers t on t.id = b.teacher_id
      where b.id = booking_id
        and t.profile_id = auth.uid()
    )
  );

-- Teachers can update sessions for bookings they are assigned to
create policy "Teachers can update sessions"
  on public.sessions for update
  using (
    exists (
      select 1 from public.bookings b
      join public.teachers t on t.id = b.teacher_id
      where b.id = booking_id
        and t.profile_id = auth.uid()
    )
  );

-- Students can read sessions for their own bookings
create policy "Students can read own sessions"
  on public.sessions for select
  using (
    exists (
      select 1 from public.bookings b
      join public.students s on s.id = b.student_id
      where b.id = booking_id
        and s.profile_id = auth.uid()
    )
  );
