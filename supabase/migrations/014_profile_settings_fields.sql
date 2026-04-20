-- Phase 3: additional profile fields for Settings + Currency
-- Adds phone, preferred_currency (ISO 4217), notification_preferences (JSONB)

alter table public.profiles
  add column if not exists phone text,
  add column if not exists preferred_currency text default 'USD',
  add column if not exists notification_preferences jsonb default jsonb_build_object(
    'email', true,
    'sms', false,
    'whatsapp', false,
    'before24h', true,
    'before1h', true
  );

-- Validation: ISO 4217 codes are 3 uppercase letters
alter table public.profiles
  drop constraint if exists profiles_preferred_currency_len;

alter table public.profiles
  add constraint profiles_preferred_currency_len
  check (preferred_currency is null or length(preferred_currency) = 3);
