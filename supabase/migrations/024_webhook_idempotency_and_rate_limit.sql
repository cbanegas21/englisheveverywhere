-- 024_webhook_idempotency_and_rate_limit.sql
-- Two hardening primitives that the MVP has been running without:
--
-- 1. `processed_stripe_events` — event-ID ledger so the Stripe webhook can
--    short-circuit on retries. Stripe retries failed/slow webhooks with the
--    same `event.id`; without this ledger a retry after a partial success
--    would double-credit a student. The primary key IS event.id, so a racing
--    retry that beats the first processor gets a 23505 (unique violation)
--    and returns a duplicate-ack response instead of re-running the handler.
--
-- 2. `auth_attempts` — ip+action+timestamp rows for application-level rate
--    limiting on /login and /registro. Supabase Auth has project-wide limits,
--    but they're generous and not per-IP. We check the 15-minute window on
--    every signIn/signUp call and bail if it exceeds the threshold. Older
--    rows are never cleaned up explicitly — at MVP scale this table stays
--    small enough that a dedicated pruner isn't worth writing yet.

create table if not exists processed_stripe_events (
  id           text primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

create table if not exists auth_attempts (
  id            bigserial primary key,
  ip            text not null,
  action        text not null check (action in ('login', 'signup')),
  email         text,
  attempted_at  timestamptz not null default now()
);

create index if not exists auth_attempts_ip_action_time_idx
  on auth_attempts (ip, action, attempted_at desc);

-- RLS: both tables are only written from server-side admin client, never
-- queried by end users. Enable RLS with no policies so the anon/authenticated
-- roles get nothing — only the service_role bypass can read/write.
alter table processed_stripe_events enable row level security;
alter table auth_attempts            enable row level security;
