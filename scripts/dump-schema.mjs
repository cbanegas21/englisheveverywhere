/**
 * Regenerate `supabase/schema.sql` from the live database by querying pg
 * catalogs via the Supabase Management API. Produces an authoritative
 * reset file that matches the actual current prod state — NOT a replay
 * of migrations-on-paper. Use when you want a `schema.sql` you could pipe
 * to `psql` on a fresh database to get an equivalent schema.
 *
 * Scope (public schema only):
 *   - Extensions required by anything in public
 *   - Tables + columns (types, defaults, nullability)
 *   - Primary + foreign keys
 *   - CHECK constraints + unique constraints
 *   - Non-constraint indexes
 *   - Row-Level Security enablement + policies
 *   - Functions (via pg_get_functiondef)
 *   - Triggers (via pg_get_triggerdef)
 *
 * NOT covered (intentionally — handled by Supabase platform or out-of-scope):
 *   - auth schema (Supabase manages it)
 *   - storage schema (Supabase manages it)
 *   - Enum / domain types (none used today; add handling if that changes)
 *   - Grants / roles (Supabase manages default grants; custom grants would
 *     need to be added by hand)
 *
 * Usage:
 *   pnpm dump-schema
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

;(function loadEnvLocal() {
  try {
    const raw = readFileSync(join(projectRoot, '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
})()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const accessToken = process.env.SUPABASE_ACCESS_TOKEN
if (!supabaseUrl || !accessToken) {
  console.error('dump-schema: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const ref = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
if (!ref) {
  console.error(`dump-schema: could not parse project ref from ${supabaseUrl}`)
  process.exit(1)
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`query failed: HTTP ${res.status} ${res.statusText}\n${sql}\n${text}`)
  }
  return res.json()
}

function section(title) {
  const bar = '='.repeat(60)
  return `-- ${bar}\n-- ${title}\n-- ${bar}\n`
}

const extensions = await query(`
  select extname, extversion
  from pg_extension
  where extname not in ('plpgsql')
  order by extname
`)

const tables = await query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`)

// format_type(atttypid, atttypmod) gives us the same string you'd see
// in `\d tablename` — including proper `text[]` for arrays and correct
// parametrized types. information_schema.data_type returns 'ARRAY' for
// arrays, which isn't valid DDL.
const columns = await query(`
  select
    c.relname as table_name,
    a.attname as column_name,
    format_type(a.atttypid, a.atttypmod) as type_fmt,
    not a.attnotnull as is_nullable,
    pg_get_expr(ad.adbin, ad.adrelid) as column_default,
    a.attnum as ordinal_position
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attnum
`)

const primaryKeys = await query(`
  select
    tc.table_name,
    string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as cols
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
   and kcu.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
  group by tc.table_name
  order by tc.table_name
`)

// pg_constraint / pg_class give us cross-schema FKs (e.g. profiles.id →
// auth.users.id). information_schema.constraint_column_usage would miss
// those when the referenced table lives outside `public`.
const foreignKeys = await query(`
  select
    c.conname as constraint_name,
    r.relname as table_name,
    rf.relname as foreign_table,
    refns.nspname as foreign_schema,
    a.attname as column_name,
    af.attname as foreign_column,
    ck.ord as position,
    case c.confdeltype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
    end as delete_rule,
    case c.confupdtype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
    end as update_rule
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace srcns on srcns.oid = r.relnamespace
  join pg_class rf on rf.oid = c.confrelid
  join pg_namespace refns on refns.oid = rf.relnamespace
  join unnest(c.conkey) with ordinality ck(attnum, ord) on true
  join pg_attribute a on a.attrelid = r.oid and a.attnum = ck.attnum
  join unnest(c.confkey) with ordinality cf(attnum, ord) on ck.ord = cf.ord
  join pg_attribute af on af.attrelid = rf.oid and af.attnum = cf.attnum
  where c.contype = 'f' and srcns.nspname = 'public'
  order by r.relname, c.conname, ck.ord
`)

const checkConstraints = await query(`
  select
    rel.relname as table_name,
    con.conname,
    pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and con.contype = 'c'
  order by rel.relname, con.conname
`)

const uniqueConstraints = await query(`
  select
    rel.relname as table_name,
    con.conname,
    pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and con.contype = 'u'
  order by rel.relname, con.conname
`)

const indexes = await query(`
  select schemaname, tablename, indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and indexname not in (
      select conname from pg_constraint where contype in ('p','u')
    )
  order by tablename, indexname
`)

const rlsTables = await query(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`)

const policies = await query(`
  select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`)

const functions = await query(`
  select
    p.proname,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname
`)

// Include row triggers on any schema whose trigger function lives in
// public — that captures on_auth_user_created on auth.users which calls
// handle_new_user(). Without this, the trigger-function pair is orphaned
// in a reset (function exists, but nothing fires it).
const triggers = await query(`
  select
    t.tgname,
    tns.nspname as table_schema,
    tc.relname as table_name,
    pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
  join pg_class tc on tc.oid = t.tgrelid
  join pg_namespace tns on tns.oid = tc.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pns on pns.oid = p.pronamespace
  where not t.tgisinternal
    and (tns.nspname = 'public' or pns.nspname = 'public')
  order by tns.nspname, tc.relname, t.tgname
`)

// Event triggers (e.g., ensure_rls wired to public.rls_auto_enable).
// pg_get_triggerdef doesn't cover event triggers, so reconstruct manually.
const eventTriggers = await query(`
  select
    et.evtname,
    et.evtevent,
    et.evtenabled,
    et.evttags,
    p.proname,
    pn.nspname as function_schema
  from pg_event_trigger et
  join pg_proc p on p.oid = et.evtfoid
  join pg_namespace pn on pn.oid = p.pronamespace
  where pn.nspname = 'public'
  order by et.evtname
`)

// ---- Emit ----

const out = []

out.push('-- AUTO-GENERATED by scripts/dump-schema.mjs — do not edit by hand.')
out.push('-- Dumped from live DB via Supabase Management API (pg catalogs).')
out.push('-- Regenerate with `pnpm dump-schema`.')
out.push('--')
out.push('-- Represents the CURRENT production state of the public schema. Run')
out.push('-- against a fresh DB to reproduce the live schema. Does NOT include')
out.push('-- auth / storage (Supabase-managed) nor seed data.')
out.push('')

out.push(section('Extensions'))
for (const e of extensions) {
  out.push(`create extension if not exists "${e.extname}";`)
}
out.push('')

out.push(section('Tables'))
for (const t of tables) {
  const tableName = t.table_name
  const cols = columns.filter(c => c.table_name === tableName)
  const pk = primaryKeys.find(p => p.table_name === tableName)
  const lines = cols.map(c => {
    const nn = c.is_nullable === false ? ' not null' : ''
    const def = c.column_default ? ` default ${c.column_default}` : ''
    return `  ${c.column_name} ${c.type_fmt}${nn}${def}`
  })
  if (pk) {
    lines.push(`  primary key (${pk.cols})`)
  }
  out.push(`create table public.${tableName} (\n${lines.join(',\n')}\n);`)
  out.push('')
}

out.push(section('Foreign Keys'))
const fksByConstraint = new Map()
for (const fk of foreignKeys) {
  const key = `${fk.table_name}.${fk.constraint_name}`
  if (!fksByConstraint.has(key)) {
    fksByConstraint.set(key, {
      table: fk.table_name,
      name: fk.constraint_name,
      cols: [],
      foreignTable: fk.foreign_table,
      foreignSchema: fk.foreign_schema,
      foreignCols: [],
      onDelete: fk.delete_rule,
      onUpdate: fk.update_rule,
    })
  }
  const entry = fksByConstraint.get(key)
  entry.cols.push(fk.column_name)
  entry.foreignCols.push(fk.foreign_column)
}
for (const fk of fksByConstraint.values()) {
  const onDelete = fk.onDelete !== 'NO ACTION' ? ` on delete ${fk.onDelete.toLowerCase()}` : ''
  const onUpdate = fk.onUpdate !== 'NO ACTION' ? ` on update ${fk.onUpdate.toLowerCase()}` : ''
  const refTable = `${fk.foreignSchema}.${fk.foreignTable}`
  out.push(
    `alter table public.${fk.table} add constraint ${fk.name} ` +
    `foreign key (${fk.cols.join(', ')}) references ${refTable} (${fk.foreignCols.join(', ')})${onDelete}${onUpdate};`,
  )
}
out.push('')

out.push(section('Check Constraints'))
for (const c of checkConstraints) {
  out.push(`alter table public.${c.table_name} add constraint ${c.conname} ${c.definition};`)
}
out.push('')

out.push(section('Unique Constraints'))
for (const u of uniqueConstraints) {
  out.push(`alter table public.${u.table_name} add constraint ${u.conname} ${u.definition};`)
}
out.push('')

out.push(section('Indexes'))
for (const i of indexes) {
  out.push(`${i.indexdef};`)
}
out.push('')

out.push(section('Row-Level Security'))
for (const t of rlsTables) {
  if (t.rls_enabled) {
    out.push(`alter table public.${t.table_name} enable row level security;`)
  }
}
out.push('')

out.push(section('Policies'))
for (const p of policies) {
  // `roles` comes back either as a JS array (if the JSON parser unpacked
  // the Postgres array) or as a literal string like "{public,authenticated}"
  // (if it came through as text). Normalize both.
  let rolesList = []
  if (Array.isArray(p.roles)) rolesList = p.roles
  else if (typeof p.roles === 'string') {
    rolesList = p.roles.replace(/^\{|\}$/g, '').split(',').map(s => s.trim()).filter(Boolean)
  }
  // Omit the TO clause when it's just `public` (the default) to match the
  // style most migrations use — `create policy ... for select using (...)`.
  const rolesClause =
    rolesList.length === 0 || (rolesList.length === 1 && rolesList[0] === 'public')
      ? ''
      : ` to ${rolesList.join(', ')}`
  const usingClause = p.qual ? ` using (${p.qual})` : ''
  const withCheckClause = p.with_check ? ` with check (${p.with_check})` : ''
  const permissive = p.permissive === 'PERMISSIVE' ? '' : ' as restrictive'
  const cmd = p.cmd.toLowerCase()
  out.push(
    `create policy "${p.policyname}" on public.${p.tablename}${permissive} for ${cmd}${rolesClause}${usingClause}${withCheckClause};`,
  )
}
out.push('')

out.push(section('Functions'))
for (const f of functions) {
  out.push(f.definition + ';')
  out.push('')
}

out.push(section('Triggers'))
for (const t of triggers) {
  out.push(t.definition + ';')
}
out.push('')

out.push(section('Event Triggers'))
for (const et of eventTriggers) {
  let tags = []
  if (Array.isArray(et.evttags)) tags = et.evttags
  else if (typeof et.evttags === 'string') {
    tags = et.evttags.replace(/^\{|\}$/g, '').split(',').map(s => s.trim()).filter(Boolean)
  }
  const tagsClause = tags.length > 0
    ? ` when tag in (${tags.map(t => `'${t}'`).join(', ')})`
    : ''
  out.push(`create event trigger ${et.evtname} on ${et.evtevent}${tagsClause} execute function ${et.function_schema}.${et.proname}();`)
}
out.push('')

const outPath = join(projectRoot, 'supabase', 'schema.sql')
writeFileSync(outPath, out.join('\n'), 'utf8')
console.log(`dump-schema: wrote ${outPath} (${out.join('\n').length} chars)`)
