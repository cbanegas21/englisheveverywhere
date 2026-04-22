-- 026_profile_soft_delete.sql
-- Soft-delete marker on profiles. Instead of a hard delete (which would
-- cascade-destroy bookings, sessions, payment history — needed for tax/audit),
-- `deleteMyAccount` sets deleted_at + scrubs PII + locks the auth user.
--
-- GDPR-compliant: the user can no longer log in, their name/avatar are
-- anonymized, and their email slot is freed on auth.users. Business records
-- stay intact for the counterparty and for accounting.

alter table profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on profiles (deleted_at)
  where deleted_at is not null;
