-- 062_drop_vestigial_write_policies.sql
-- Deep-audit RLS-3 + RLS-4 (defense-in-depth, mirrors migration 048). Two more
-- browser-reachable write policies that the app never relies on — every write to
-- both tables goes through the service-role admin client (which bypasses RLS):
--
--   * availability_slots: "Teachers manage own availability" [FOR ALL] let a
--     teacher REST-write availability_slots directly, bypassing the server-side
--     overlap guard in saveAvailabilitySlots (which writes via the
--     replace_availability_slots RPC on the admin client). RLS-3.
--   * reschedule_requests: the student/teacher INSERT+UPDATE policies let a user
--     PATCH status/proposed_scheduled_at/reason on their own request via REST
--     (no WITH CHECK column restriction). Harmless today — only the admin action
--     moves a booking, and it re-validates — but it's vestigial write surface
--     (requestReschedule / cancelRescheduleRequest / admin approve all write via
--     the admin client). RLS-4. SELECT policies + the admin FOR ALL policy stay.

-- RLS-3
drop policy if exists "Teachers manage own availability" on public.availability_slots;
revoke insert, update, delete on public.availability_slots from authenticated, anon;

-- RLS-4 — drop the per-user WRITE policies, keep the SELECT + admin policies.
drop policy if exists "reschedule_student_insert" on public.reschedule_requests;
drop policy if exists "reschedule_student_update" on public.reschedule_requests;
drop policy if exists "reschedule_teacher_insert" on public.reschedule_requests;
drop policy if exists "reschedule_teacher_update" on public.reschedule_requests;
revoke insert, update, delete on public.reschedule_requests from authenticated, anon;
