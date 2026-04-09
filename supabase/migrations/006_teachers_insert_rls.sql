-- ============================================================
-- Migration 006: Fix teacher INSERT RLS policy
--
-- "new row violates row-level security policy for table teachers"
-- occurs during teacher onboarding upsert when no INSERT policy
-- exists or migration 001 was not applied to the live database.
--
-- This is safe to run regardless of whether migration 001 was
-- previously applied — Postgres merges permissive policies with OR.
-- Run in Supabase SQL Editor.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'teachers'
      AND policyname = 'Teachers can insert their own record'
  ) THEN
    CREATE POLICY "Teachers can insert their own record"
      ON public.teachers
      FOR INSERT
      WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- Verify: this query should return at least one INSERT policy for teachers
-- SELECT policyname, cmd, with_check
-- FROM pg_policies
-- WHERE tablename = 'teachers' AND cmd = 'INSERT';
