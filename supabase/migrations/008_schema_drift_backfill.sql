-- ============================================================
-- MIGRATION 008: Back-fill schema drift
-- ============================================================
-- These columns were added to the live Supabase DB ad-hoc but never
-- captured in schema.sql or an earlier migration. Every ALTER uses
-- IF NOT EXISTS so re-applying on live is a no-op; a fresh DB build
-- picks up the columns from here.

-- Students: placement state, current plan key, admin free-text
alter table public.students
  add column if not exists survey_answers       jsonb,
  add column if not exists placement_scheduled  boolean not null default false,
  add column if not exists current_plan         text,
  add column if not exists admin_notes          text;

-- Teachers: admin free-text
alter table public.teachers
  add column if not exists admin_notes          text;

-- Bookings: distinguish class vs placement_test + admin meeting notes
alter table public.bookings
  add column if not exists type           text not null default 'class',
  add column if not exists meeting_notes  text;
