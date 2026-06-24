-- ============================================================
-- MIGRATION 055: Assignment upgrade (file attachment + rubric + audio feedback)
-- ============================================================
-- Extends migration 017 assignments / assignment_submissions ADDITIVELY. The
-- 017 header noted "File attachments land in a later migration after storage
-- buckets exist" — this is that migration. Files reuse the private 'lab-files'
-- bucket (migration 054); downloads go through an entitlement-gated signed URL
-- (getAssignmentFileSignedUrl), never a public URL.
--
-- All new columns are nullable → no backfill, no behavior change for existing
-- rows. NO RLS change: the 017 SELECT policies already cover the whole row, and
-- every write stays on the service-role admin client after auth + ownership
-- checks. Credit-neutral. Additive + idempotent; apply via the Management API.

alter table public.assignments
  add column if not exists rubric          text, -- marking guide / criteria, shown to the student
  add column if not exists attachment_path text, -- a file the teacher attaches for the student
  add column if not exists attachment_name text;

alter table public.assignment_submissions
  add column if not exists attachment_path     text, -- a file the student attaches to their submission
  add column if not exists attachment_name     text,
  add column if not exists audio_feedback_path text, -- the teacher's audio feedback file
  add column if not exists audio_feedback_name text;
