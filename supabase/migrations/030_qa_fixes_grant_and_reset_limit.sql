-- 030_qa_fixes_grant_and_reset_limit.sql
-- Dynamic-QA fixes (2026-06-09). Apply via the Supabase Management API, then
-- run `pnpm gen-types` + `pnpm dump-schema`.
--
-- LIVE-S02: the teacher "Accepting students" toggle silently fails with a 403.
--   Migration 016 locked teachers UPDATE to a column allowlist (bio,
--   specializations, certifications); migration 028 added `accepting_students`
--   but never added it to that grant, so the browser PATCH is rejected. The RLS
--   row policy ("Teachers manage own") already exists — only the column grant is
--   missing.
--
-- LIVE-S04: allow the new 'reset' action in auth_attempts so password-reset
--   requests can be rate-limited (the CHECK previously permitted only
--   login/signup, so a 'reset' insert would fail and the limiter would no-op).

grant update (accepting_students) on public.teachers to authenticated;

alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action = any (array['login'::text, 'signup'::text, 'reset'::text]));
