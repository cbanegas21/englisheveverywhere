-- 034_payments_unique_and_atomic_credit.sql
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema
-- (a new function + index appear in the dump; types are unaffected by either).
--
-- 1. add_classes_with_plan: grant credits AND set current_plan in ONE atomic
--    statement. The Stripe webhook previously did add_classes then a separate
--    current_plan UPDATE — a partial success (credit ok, plan fails) released the
--    idempotency ledger and let Stripe's retry DOUBLE-CREDIT. One statement =
--    both succeed or both fail, so a retry after failure re-runs cleanly.
--
-- 2. payments_booking_id_unique: DB-level guard so completeSession can't double-pay
--    a teacher under a concurrent flip (it ignores the 23505 this raises). payments
--    is empty at apply time (QA records nuked), so no existing duplicates block it.

create or replace function public.add_classes_with_plan(
  p_student_id uuid,
  p_count integer,
  p_plan_key text
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update students
  set classes_remaining = classes_remaining + p_count,
      current_plan = p_plan_key
  where id = p_student_id;
end;
$function$;

create unique index if not exists payments_booking_id_unique
  on public.payments (booking_id);
