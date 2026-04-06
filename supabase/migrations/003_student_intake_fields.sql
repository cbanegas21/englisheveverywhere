-- ============================================================
-- MIGRATION 003: Student intake / learning profile fields
-- ============================================================
-- Run in Supabase SQL Editor after 002_teacher_own_rls.sql

-- Add intake columns to students table
alter table public.students
  add column if not exists learning_goal     text,
  add column if not exists work_description  text,
  add column if not exists learning_style    text
    check (learning_style in ('visual', 'auditory', 'reading', 'mixed')),
  add column if not exists age_range         text
    check (age_range in ('under_18', '18_25', '26_40', '40_plus')),
  add column if not exists intake_done       boolean not null default false;

-- Allow teachers to read intake data for students they have bookings with
-- (needed so teacher dashboard can display student profile info)
drop policy if exists "Teachers can read student intake" on public.students;

create policy "Teachers can read student intake"
  on public.students for select
  using (
    auth.uid() in (
      select t.profile_id
      from public.teachers t
      join public.bookings b on b.teacher_id = t.id
      where b.student_id = students.id
    )
  );
