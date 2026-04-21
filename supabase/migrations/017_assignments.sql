-- ============================================================
-- MIGRATION 017: Assignments (teacher homework) + submissions
-- ============================================================
-- Teachers currently have no way to assign homework (Bug #32).
-- This migration adds:
--   • public.assignments          — a homework item for a specific student
--   • public.assignment_submissions — the student's single response
-- Plus RLS policies so teacher, student, and admin each see the right slice.
--
-- Scope: text-only MVP. File attachments land in a later migration after
-- storage buckets exist (Bug #33 work).

-- ── assignments ───────────────────────────────────────────────────────
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  title        text not null,
  instructions text not null default '',
  due_at       timestamptz,
  status       text not null default 'open' check (status in ('open', 'cancelled')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_assignments_student on public.assignments(student_id, created_at desc);
create index if not exists idx_assignments_teacher on public.assignments(teacher_id, created_at desc);

alter table public.assignments enable row level security;

-- Teacher can SELECT rows where they are the owner.
drop policy if exists "teacher reads own assignments" on public.assignments;
create policy "teacher reads own assignments" on public.assignments
  for select using (
    teacher_id in (select id from public.teachers where profile_id = auth.uid())
  );

-- Student can SELECT rows where they are the target.
drop policy if exists "student reads own assignments" on public.assignments;
create policy "student reads own assignments" on public.assignments
  for select using (
    student_id in (select id from public.students where profile_id = auth.uid())
  );

-- Admin reads everything.
drop policy if exists "admin reads assignments" on public.assignments;
create policy "admin reads assignments" on public.assignments
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Write paths all go through server actions using the service-role admin
-- client after role + ownership checks, mirroring the placement.ts pattern.
-- No direct INSERT/UPDATE/DELETE from authenticated is needed.

-- ── assignment_submissions ────────────────────────────────────────────
create table if not exists public.assignment_submissions (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null unique references public.assignments(id) on delete cascade,
  submitted_text   text not null default '',
  submitted_at     timestamptz not null default now(),
  teacher_feedback text,
  score            text check (score is null or score in ('A1','A2','B1','B2','C1','C2','needs_work','good','excellent')),
  graded_at        timestamptz
);

create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);

alter table public.assignment_submissions enable row level security;

-- Teacher reads submissions for their own assignments.
drop policy if exists "teacher reads own submissions" on public.assignment_submissions;
create policy "teacher reads own submissions" on public.assignment_submissions
  for select using (
    assignment_id in (
      select id from public.assignments where teacher_id in (
        select id from public.teachers where profile_id = auth.uid()
      )
    )
  );

-- Student reads their own submission.
drop policy if exists "student reads own submissions" on public.assignment_submissions;
create policy "student reads own submissions" on public.assignment_submissions
  for select using (
    assignment_id in (
      select id from public.assignments where student_id in (
        select id from public.students where profile_id = auth.uid()
      )
    )
  );

-- Admin reads everything.
drop policy if exists "admin reads submissions" on public.assignment_submissions;
create policy "admin reads submissions" on public.assignment_submissions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
