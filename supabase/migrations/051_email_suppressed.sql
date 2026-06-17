-- 051: email suppression flag (P2-9).
-- Set true when Resend reports a hard bounce or spam complaint for the address
-- (via /api/resend/webhook). The recurring senders (reminders) skip suppressed
-- recipients so we stop emailing dead/complaining addresses, protecting the new
-- domain's sender reputation. Defaults false; existing rows are unaffected.
alter table public.profiles
  add column if not exists email_suppressed boolean not null default false;
