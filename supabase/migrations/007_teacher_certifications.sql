-- Migration 007: Add certifications column to teachers table
-- Teachers self-report certifications (TESOL, CELTA, etc.) during onboarding.
-- Admin reviews these; rate is set by admin only, not teacher.
-- Run in Supabase SQL Editor.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}';
