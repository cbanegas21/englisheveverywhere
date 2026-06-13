-- 042_lock_credit_rpc_execute.sql
-- Apply via the Supabase Management API (CLAUDE.md migration workflow).
--
-- CRITICAL (AG-SEC-CREDIT-RPC-02, verified live on prod): the credit-ledger RPCs
-- increment_classes / decrement_classes / add_classes / add_classes_with_plan are
-- SECURITY DEFINER and were left with the default EXECUTE = PUBLIC (plus explicit
-- anon + authenticated grants). That let ANY logged-in user call them directly
-- from the browser (the public anon key + their own session JWT) to:
--   • self-mint unlimited class credits (increment_classes / add_classes),
--   • set their own plan to a paid tier for free (add_classes_with_plan),
--   • grant OR drain credits on ANY other student by id (no auth.uid() check).
-- = a full Stripe paywall bypass + cross-account credit tampering.
--
-- migration 016 locked the students TABLE column UPDATE grant but NOT these RPCs.
-- Every legitimate caller invokes them through the service-role admin client
-- (createBooking, decline/cancel/no-show/admin refunds, admin grant-classes, the
-- Stripe webhook) — never the user/anon client — so revoking EXECUTE from
-- PUBLIC/anon/authenticated closes the hole with zero functional impact.
-- service_role keeps EXECUTE.
--
-- Defense-in-depth note: the functions still lack an internal auth.uid() ownership
-- check, but with EXECUTE limited to service_role they are no longer reachable by
-- an untrusted caller. (A future hardening could add ownership assertions.)

REVOKE EXECUTE ON FUNCTION public.increment_classes(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_classes(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_classes(uuid, integer)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_classes_with_plan(uuid, integer, text) FROM PUBLIC, anon, authenticated;
