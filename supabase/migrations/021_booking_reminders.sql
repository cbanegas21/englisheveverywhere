-- 021_booking_reminders.sql
-- Idempotency flags for the reminder cron (24h / 1h before class). Without
-- these, repeated cron runs would re-send the same email every tick.

alter table bookings
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at  timestamptz;

-- Narrow indexes — only rows where the flag is null are candidates, so a
-- partial index makes the cron's "pending reminders" query constant-time as
-- the booking table grows.
create index if not exists bookings_pending_24h_reminder_idx
  on bookings (scheduled_at)
  where reminder_24h_sent_at is null and status = 'confirmed';

create index if not exists bookings_pending_1h_reminder_idx
  on bookings (scheduled_at)
  where reminder_1h_sent_at is null and status = 'confirmed';
