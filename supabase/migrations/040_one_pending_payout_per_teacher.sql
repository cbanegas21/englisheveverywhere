-- 040_one_pending_payout_per_teacher.sql  (TE-04 ph2c hardening)
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema.
--
-- Race safety net: a teacher may have many 'paid'/'cancelled' payouts but at most
-- ONE 'pending' at a time. Stops two concurrent weekly sweeps (or a double-submit)
-- from creating duplicate pending payouts for the same teacher — the second insert
-- hits 23505 and the sweep skips it. Partial unique index.

create unique index if not exists teacher_payouts_one_pending_per_teacher
  on public.teacher_payouts (teacher_id)
  where status = 'pending';
