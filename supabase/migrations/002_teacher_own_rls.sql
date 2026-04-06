-- ============================================================
-- Migration 002: Allow teachers to read their own record
-- regardless of is_active status.
--
-- Without this policy, a teacher with is_active = false
-- cannot query their own teachers row, breaking the
-- pending-review flow and onboarding redirects.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create policy "Teachers can view own record"
  on public.teachers for select
  using (auth.uid() = profile_id);
