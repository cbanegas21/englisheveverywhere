-- ============================================================
-- MIGRATION 019: Teacher CV / résumé storage
-- ============================================================
-- Fathom bug #4: teacher applications had no way to upload a CV, so
-- admin had no reference material to verify credentials with.
--
-- Adds:
--   • storage bucket `teacher-docs` (private — admin-only access via
--     signed URLs from the admin client)
--   • teachers.cv_storage_path (text) — pointer to the uploaded file
--   • teachers.cv_uploaded_at (timestamptz) — audit / display
--   • teachers.cv_original_filename (text) — so admin UI can show
--     the original filename when presenting the signed URL
--
-- The bucket is private. Writes and reads happen through the
-- service-role admin client from server actions; admin UIs call a
-- signed-URL action to fetch the file for review.

insert into storage.buckets (id, name, public)
  values ('teacher-docs', 'teacher-docs', false)
  on conflict (id) do nothing;

alter table public.teachers
  add column if not exists cv_storage_path text,
  add column if not exists cv_uploaded_at timestamptz,
  add column if not exists cv_original_filename text;

comment on column public.teachers.cv_storage_path is
  'Storage-bucket key in teacher-docs. NULL if the teacher has not uploaded a CV yet.';
