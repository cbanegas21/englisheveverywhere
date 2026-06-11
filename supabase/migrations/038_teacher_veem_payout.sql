-- 038_teacher_veem_payout.sql  (TE-04 phase 2)
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema.
--
-- Teacher payout setup for the Veem-based weekly auto-sweep. The teacher creates
-- a Veem account and saves its email here; cleared earnings (past the 7-day hold)
-- are swept to that Veem account weekly. No "withdraw" button — it auto-flows.
-- Stripe Connect is being retired for teacher payouts (it can't pay Honduras).

alter table public.teachers
  add column if not exists payout_veem_email text,
  add column if not exists payout_setup_at  timestamptz;
