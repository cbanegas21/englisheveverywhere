-- 046_atomic_teacher_sessions.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow), then
-- run `pnpm gen-types` + `pnpm dump-schema`.
--
-- Atomic teacher.total_sessions increment. completeSession + the admin
-- completeBooking fallback both bumped the counter with a non-atomic
-- read-then-write, so two DIFFERENT bookings for the same teacher completing
-- concurrently could lose one increment (counter drift). This single-statement
-- RPC fixes it. SECURITY DEFINER with EXECUTE locked to service_role only — the
-- legit callers use the service-role admin client; it must NEVER be browser-
-- callable (per the migration 042 hardening of the credit RPCs).

create or replace function public.increment_teacher_sessions(p_teacher_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.teachers
  set total_sessions = coalesce(total_sessions, 0) + 1
  where id = p_teacher_id;
$$;

revoke execute on function public.increment_teacher_sessions(uuid) from public, anon, authenticated;
