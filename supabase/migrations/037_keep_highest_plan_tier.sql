-- 037_keep_highest_plan_tier.sql  (STRIPE-03)
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema.
--
-- Bug: add_classes_with_plan (migration 034) sets current_plan = p_plan_key
-- UNCONDITIONALLY. A student on Summit (peak) who buys a small top-up pack
-- (e.g. Departure / spark) has their DISPLAYED plan overwritten with the smaller
-- one — a visible downgrade even though they paid to add classes.
--
-- Fix: keep the HIGHEST tier ever purchased. Credits still always accrue; only
-- current_plan is gated so it never moves down. Tier rank mirrors src/lib/pricing.ts
-- (spark < drive < ascent < peak). Unknown/legacy keys rank 0, so any known plan
-- beats an unknown, and a null current_plan is always set.

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
declare
  v_rank constant jsonb := '{"spark":1,"drive":2,"ascent":3,"peak":4}'::jsonb;
  v_new_rank integer := coalesce((v_rank ->> p_plan_key)::integer, 0);
begin
  update students
  set classes_remaining = classes_remaining + p_count,
      current_plan = case
        when current_plan is null then p_plan_key
        when v_new_rank >= coalesce((v_rank ->> current_plan)::integer, 0) then p_plan_key
        else current_plan
      end
  where id = p_student_id;
end;
$function$;
