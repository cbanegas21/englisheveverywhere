-- ============================================================
-- MIGRATION 009: Re-seed plans table to match lib/pricing.ts
-- ============================================================
-- Canonical plan keys (spark/drive/ascent/peak at $129/$179/$219/$259)
-- live in a plan_key column with a unique index. Legacy rows
-- (Starter/Standard/Intensive at $39/$69/$119) are deactivated rather
-- than deleted so any existing subscriptions.plan_id references
-- remain valid. ON CONFLICT makes the upsert idempotent on re-run.

alter table public.plans
  add column if not exists plan_key text;

create unique index if not exists plans_plan_key_key
  on public.plans (plan_key);

-- Deactivate legacy rows from the original seed
update public.plans
  set is_active = false
  where plan_key is null
    and name in ('Starter', 'Standard', 'Intensive');

-- Upsert current plans by key
insert into public.plans (
    plan_key, name, name_es, classes_per_month, price_usd,
    is_popular, description, description_es, is_active
)
values
  ('spark',  'Spark',  'Chispa',  8,  129.00, false, '8 one-on-one classes per month',  '8 clases uno a uno por mes', true),
  ('drive',  'Drive',  'Impulso', 12, 179.00, false, '12 one-on-one classes per month', '12 clases uno a uno por mes', true),
  ('ascent', 'Ascent', 'Ascenso', 16, 219.00, true,  '16 one-on-one classes per month', '16 clases uno a uno por mes', true),
  ('peak',   'Peak',   'Cima',    20, 259.00, false, '20 one-on-one classes per month', '20 clases uno a uno por mes', true)
on conflict (plan_key) do update set
  name              = excluded.name,
  name_es           = excluded.name_es,
  classes_per_month = excluded.classes_per_month,
  price_usd         = excluded.price_usd,
  is_popular        = excluded.is_popular,
  description       = excluded.description,
  description_es    = excluded.description_es,
  is_active         = excluded.is_active;
