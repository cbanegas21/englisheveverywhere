-- 036_auth_attempts_action_types.sql
-- Apply via the Supabase Management API, then run pnpm dump-schema (no type change).
--
-- Expand the auth_attempts.action CHECK so the per-user mutation throttle
-- (DASH-07, checkUserActionLimit) can record rows. The limiter reuses this table
-- with action='createBooking' / 'bookPlacementCall' / 'requestEmailChange'; the
-- old CHECK (login/signup/reset only) silently rejected those inserts, leaving
-- the rate limit a no-op. Additive only — existing rows/values are unaffected.

alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action = any (array['login', 'signup', 'reset', 'createBooking', 'bookPlacementCall', 'requestEmailChange']));
