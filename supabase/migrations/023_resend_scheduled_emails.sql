-- 023_resend_scheduled_emails.sql
-- Replace the reminder cron with Resend's native scheduled-delivery. At the
-- moment a booking is confirmed, we schedule two emails per recipient on
-- Resend with a `scheduled_at` that targets T-24h and T-1h. Resend fires them
-- without any polling on our end, so we no longer need the Vercel cron.
--
-- To cancel an in-flight scheduled email (e.g. on booking cancel/reschedule)
-- we call POST /emails/:id/cancel on Resend. That means we have to persist
-- the Resend email IDs — one per reminder email scheduled for this booking.
--
-- The old `reminder_24h_sent_at` / `reminder_1h_sent_at` columns and their
-- partial indexes from migration 021 are now dead weight; this migration
-- drops them to keep the schema tidy.

alter table bookings
  add column if not exists scheduled_email_ids text[] default '{}';

drop index if exists bookings_pending_24h_reminder_idx;
drop index if exists bookings_pending_1h_reminder_idx;

alter table bookings
  drop column if exists reminder_24h_sent_at,
  drop column if exists reminder_1h_sent_at;
