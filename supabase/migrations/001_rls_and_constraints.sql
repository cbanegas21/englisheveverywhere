-- ============================================================
-- Migration 001: RLS INSERT policies + UNIQUE constraints
-- Run this in Supabase SQL Editor if you already applied schema.sql
-- ============================================================

-- UNIQUE constraints so upsert works on profile_id
ALTER TABLE public.students
  ADD CONSTRAINT IF NOT EXISTS students_profile_id_unique UNIQUE (profile_id);

ALTER TABLE public.teachers
  ADD CONSTRAINT IF NOT EXISTS teachers_profile_id_unique UNIQUE (profile_id);

-- INSERT RLS policy for students (needed for onboarding upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students' AND policyname = 'Students can create own record'
  ) THEN
    CREATE POLICY "Students can create own record"
      ON public.students FOR INSERT
      WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

-- INSERT RLS policy for teachers (needed for onboarding upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'teachers' AND policyname = 'Teachers can create own record'
  ) THEN
    CREATE POLICY "Teachers can create own record"
      ON public.teachers FOR INSERT
      WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

-- INSERT RLS policy for payments (needed for completeSession)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments' AND policyname = 'Participants can record payments'
  ) THEN
    CREATE POLICY "Participants can record payments"
      ON public.payments FOR INSERT
      WITH CHECK (
        auth.uid() IN (
          SELECT profile_id FROM public.students WHERE id = student_id
          UNION
          SELECT profile_id FROM public.teachers WHERE id = teacher_id
        )
      );
  END IF;
END $$;
