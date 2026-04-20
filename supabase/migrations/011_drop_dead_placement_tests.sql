-- ============================================================
-- MIGRATION 011: Drop the dead placement_tests table
-- ============================================================
-- Defined in schema.sql but never written to. The real placement
-- flow uses bookings.type = 'placement_test' + students.survey_answers.
-- Dropping removes a source of confusion for future contributors.

drop table if exists public.placement_tests cascade;
