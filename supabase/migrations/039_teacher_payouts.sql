-- 039_teacher_payouts.sql  (TE-04 phase 2c)
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema.
--
-- Ledger of weekly payout batches. The weekly sweep creates one 'pending' row per
-- teacher for their available (cleared − already-committed) balance; the admin
-- pays it out wallet-to-wallet in Veem and marks it 'paid'. Running-balance model
-- (no per-session link in v1): a teacher's available = cleared earnings minus the
-- sum of their pending+paid payouts. RLS on, no policies → service-role only
-- (the app reads/writes via the admin client after auth checks).

create table if not exists public.teacher_payouts (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  amount_usd  numeric(10,2) not null check (amount_usd > 0),
  veem_email  text,
  status      text not null default 'pending' check (status in ('pending','paid','cancelled')),
  period_end  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  paid_by     uuid,
  note        text
);

create index if not exists teacher_payouts_teacher_idx on public.teacher_payouts (teacher_id, created_at desc);
create index if not exists teacher_payouts_status_idx  on public.teacher_payouts (status);

alter table public.teacher_payouts enable row level security;
