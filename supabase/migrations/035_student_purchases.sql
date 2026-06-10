-- 035_student_purchases.sql
-- Apply via the Supabase Management API, then run pnpm gen-types + dump-schema.
--
-- Student-facing billing history / receipts. The existing `payments` table is
-- teacher-payout-shaped (teacher_id NOT NULL, unique(booking_id)) so it cannot
-- hold a plan purchase (no booking, no teacher). This table records each
-- successful Stripe class-pack checkout so the student can see + print a receipt.
-- Written ONLY by the Stripe webhook (service-role, RLS-bypassing); students read
-- their OWN rows via RLS. unique(stripe_session_id) makes the webhook insert
-- idempotent under Stripe retries.

create table if not exists public.student_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  plan_key text not null,
  amount_usd numeric(10,2) not null,
  classes_added integer not null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists student_purchases_student_id_idx
  on public.student_purchases (student_id, created_at desc);

alter table public.student_purchases enable row level security;

-- Students read their own purchases. Writes are service-role only (the webhook),
-- so there is intentionally no insert/update/delete policy for `authenticated`.
drop policy if exists "Students read own purchases" on public.student_purchases;
create policy "Students read own purchases"
  on public.student_purchases
  for select
  to authenticated
  using (student_id = public.auth_student_id());
