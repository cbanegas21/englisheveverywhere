-- 031_rls_teacher_confidentiality.sql
-- SECURITY (static-audit + dynamic-QA HIGH): the browser ANON key could
-- GET /rest/v1/teachers and /availability_slots and read the FULL teacher roster
-- (+ stripe_account_id / hourly_rate / admin_notes) with NO login — both policies
-- used `for select using (is_active = true)` with no role scoping (implicitly to public).
-- It also let any AUTHENTICATED student enumerate the whole roster, violating the
-- one-to-one / no-roster confidentiality rule.
--
-- Verified-safe read-pattern map (2026-06-09): every app read of these tables is
-- SERVICE-ROLE (admin client, bypasses RLS) or OWNER-SCOPED SSR — teacher reads own
-- row ("Teachers can view own record") / own slots ("Teachers manage own availability");
-- student reads only their MATCHED teacher (new policy). No anon/browser read depends
-- on the public policies. hourly_rate + stripe_account_id are intentionally still
-- readable (teacher reads own; student sees matched teacher's price); only admin_notes
-- is column-restricted.
--
-- Verified LIVE after apply: anon→blocked, matched-student→1 row, roster→not enumerable,
-- admin_notes→blocked, teacher-own→works, admin(service role)→unaffected.
-- Apply via the Supabase Management API, then `pnpm gen-types` + `pnpm dump-schema`.

-- 1) Helper: a SECURITY DEFINER lookup that bypasses RLS on students/bookings.
--    Referencing those tables inside the teachers policy directly causes
--    `infinite recursion` (teachers policy -> bookings RLS -> teachers policy ...).
--    Mirrors the existing auth_student_id() pattern.
create or replace function public.is_matched_teacher(p_teacher_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.profile_id = auth.uid() and s.primary_teacher_id = p_teacher_id
  ) or exists (
    select 1 from public.bookings b
    join public.students s on s.id = b.student_id
    where s.profile_id = auth.uid() and b.teacher_id = p_teacher_id
  );
$$;

-- 2) TEACHERS: drop the public "everyone sees active teachers" policy; replace with a
--    matched-student-only read. Teacher's own-record SELECT stays via the existing
--    "Teachers can view own record"; admin reads via service role.
drop policy if exists "Teachers are publicly visible" on public.teachers;
create policy "Students read their matched teacher" on public.teachers
  for select to authenticated
  using (public.is_matched_teacher(id));

-- 3) AVAILABILITY_SLOTS: drop the public policy. Teacher own read/write stays via
--    "Teachers manage own availability"; admin assigns via service role.
drop policy if exists "Availability slots are publicly visible" on public.availability_slots;

-- 4) Column privileges: a table-level SELECT grant would override a column REVOKE, so
--    replace it with explicit column grants — every column EXCEPT admin_notes
--    (internal, admin-only). anon gets no table SELECT (RLS denies its rows anyway).
revoke select on public.teachers from authenticated;
revoke select on public.teachers from anon;
grant select (
  id, profile_id, bio, specializations, certifications, hourly_rate, rating,
  total_sessions, stripe_account_id, is_active, created_at, cv_storage_path,
  cv_uploaded_at, cv_original_filename, accepting_students
) on public.teachers to authenticated;
