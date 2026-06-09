-- 033_profiles_hide_contact_columns.sql
-- Apply via the Supabase Management API. NO gen-types/dump-schema change (grants
-- aren't reflected in generated types or the schema dump).
--
-- Close the teacher-contact-PII leak: the "Students can read teacher profiles"
-- RLS policy lets a matched student SELECT their teacher's profiles ROW, and RLS
-- is row-level — it can't hide columns — so the teacher's email + phone leaked.
-- Column grants ARE column-level but table-wide per role, so: revoke the
-- table-level SELECT, then re-grant every column EXCEPT email + phone.
--
-- ⚠ ORDERING: deploy the code change FIRST (dashboard/configuracion/page.tsx now
-- reads its own phone via the service-role client, which bypasses grants), THEN
-- apply this. Applying it while the old user-scoped phone read is still live would
-- 500 the student settings page.
--
-- Safe because: own email is read from auth.users (auth.getUser()), never from
-- profiles; own phone is read via the service-role client (configuracion);
-- every other authenticated profiles read selects only granted columns
-- (role/full_name/avatar_url/timezone/preferred_language/preferred_currency/
-- notification_preferences). anon is left as-is — RLS already blocks ALL anon
-- profile rows (no anon-permitting policy), so its grant is moot.
--
-- Table-level GRANT SELECT overrides column-level grants, so the REVOKE is
-- required first (same pattern as migration 031 / the teachers column lockdown).

revoke select on public.profiles from authenticated;

grant select (
  id,
  full_name,
  avatar_url,
  role,
  timezone,
  preferred_language,
  created_at,
  updated_at,
  preferred_currency,
  notification_preferences,
  deleted_at
) on public.profiles to authenticated;
