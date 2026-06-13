-- 043_atomic_refund_decrement.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow).
--
-- AG-MONEY-09 / REFUND-ATOMIC: the Stripe charge.refunded handler reversed credits
-- with a NON-atomic read-then-Math.max(0,current-N)-write (api/stripe/webhook
-- route.ts). A concurrent classes_remaining writer (a booking's decrement_classes,
-- a 2nd refund, an admin grant) landing between the read and the write is a lost
-- update -> wrong balance. This is the only non-atomic credit write left; every
-- other path uses an atomic single-statement RPC.
--
-- This adds an atomic, floored, single-statement decrement (mirrors
-- decrement_classes/increment_classes) and also clears current_plan when the
-- balance reaches 0 (preserving the handler's prior behavior). SECURITY DEFINER
-- with EXECUTE locked to service_role only — the webhook calls it via the admin
-- client; it must NEVER be callable from the browser (per the migration 042
-- hardening of the other credit RPCs).
--
-- Note: in a single UPDATE all SET expressions read the OLD row, so the CASE and
-- the classes_remaining assignment compute the same post-decrement value.

create or replace function public.decrement_classes_by(p_student_id uuid, p_count integer)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.students
  set classes_remaining = greatest(0, classes_remaining - greatest(0, coalesce(p_count, 0))),
      current_plan = case
        when greatest(0, classes_remaining - greatest(0, coalesce(p_count, 0))) = 0 then null
        else current_plan
      end
  where id = p_student_id;
$$;

revoke execute on function public.decrement_classes_by(uuid, integer) from public, anon, authenticated;
