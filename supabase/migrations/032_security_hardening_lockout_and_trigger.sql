-- 032_security_hardening_lockout_and_trigger.sql
-- Static Batch-1 security hardening (2026-06-09). Apply via the Supabase
-- Management API, then run `pnpm gen-types` + `pnpm dump-schema`.
--
-- 1. Per-account (per-email) failed-login lockout for the auth rate limiter.
--    The per-IP cap is dodged by a distributed run that rotates IPs against ONE
--    account; counting FAILED logins per email across all IPs catches it.
--    `success` marks each attempt's outcome so the lockout counts only failures
--    (a successful login never contributes). Existing rows are historical
--    attempts → default true so they can't trip a lockout. Index supports the
--    per-email failure lookup. See src/lib/rateLimit.ts.
--
-- 2. Harden handle_new_user: coerce any signup role that isn't 'student' or
--    'teacher' (notably 'admin', or garbage) down to 'student'. The app layer
--    already coerces the client-supplied role (actions/auth.ts signUp), so this
--    is defense-in-depth at the DB trigger — a direct admin-API / SQL signup
--    that sets raw_user_meta_data.role = 'admin' can no longer self-provision an
--    admin. Real admins are provisioned out-of-band via the service-role path,
--    never through signup metadata.

-- 1 ───────────────────────────────────────────────────────────────────────────
alter table public.auth_attempts
  add column if not exists success boolean not null default true;

create index if not exists auth_attempts_email_action_time_idx
  on public.auth_attempts (email, action, attempted_at desc);

-- 2 ───────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('student', 'teacher')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end
  );
  return new;
end;
$function$;
