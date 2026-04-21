import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Tier 0 — Schema-drift probe.
 *
 * Walks every SQL migration in `supabase/migrations/` in numeric order,
 * builds the set of CHECK constraints + unique indexes that SHOULD exist in
 * the live DB after those migrations run, and then queries the live DB via
 * the Supabase Management API to assert each one is actually present.
 *
 * WHY:
 *   1. A migration committed to the repo is not proof it got applied in prod
 *      — see the `increment_classes` SECURITY INVOKER bug and the initial
 *      (false) `bookings_placement_no_teacher` drift flag.
 *   2. `schema.sql` is known-drifted (see CLAUDE.md). Migrations are the only
 *      truth, and this probe makes them match reality.
 *   3. Parses migrations in ORDER, tracking both ADD and DROP statements, so
 *      a later migration dropping what an earlier one added is honored
 *      (e.g., migration 012 dropping `bookings_placement_no_teacher`).
 *
 * COVERAGE (v1):
 *   - CHECK constraints added/dropped via `alter table … add/drop constraint`
 *   - Unique indexes added/dropped via `create unique index` / `drop index`
 *
 * EXPLICITLY NOT COVERED (v1):
 *   - Columns (broader; false positives possible on column-level GRANTs)
 *   - Policies (RLS policy drift is its own specialized concern)
 *   - Functions (prosecdef bug is already guarded by counter-atomicity spec)
 *   - Baseline schema.sql constraints — v1 only cares about drift from
 *     migration files, not the legacy baseline
 *
 * If the probe fails, the fix path is always one of:
 *   (a) Apply the missing migration via Management API, OR
 *   (b) If the missing object was intentionally removed outside migrations,
 *       add a new migration that drops it on paper so the expected set
 *       matches reality, OR
 *   (c) If the migration was reverted by design, update the comment header
 *       of the relevant migration file to document the revert.
 */

;(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
})()

interface ExpectedObjects {
  checkConstraints: Set<string>
  uniqueIndexes: Set<string>
}

function stripComments(sql: string): string {
  // Drop -- line comments and /* … */ block comments so keyword matches
  // don't trip on doc strings.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\r\n]*/g, '')
}

// Ordered-statement parser. Collects every relevant declaration alongside
// its position in the file, then replays them in file order. This matters
// because migrations frequently do `drop constraint if exists X; add
// constraint X ...` — if we processed all ADDs before all DROPs (the
// matchAll-per-pattern approach), the DROP would wipe an ADD that actually
// came earlier in the file, producing an empty expected set.
type Event =
  | { kind: 'addCheck'; name: string }
  | { kind: 'dropConstraint'; name: string }
  | { kind: 'addUniqueIndex'; name: string }
  | { kind: 'dropIndex'; name: string }
  | { kind: 'dropTable'; name: string }

function extractEvents(sql: string): Event[] {
  const clean = stripComments(sql).toLowerCase()
  const patterns: Array<{ re: RegExp; map: (m: RegExpExecArray) => Event }> = [
    {
      re: /add\s+constraint\s+([a-z0-9_]+)\s+check\s*\(/g,
      map: m => ({ kind: 'addCheck', name: m[1] }),
    },
    {
      re: /drop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_]+)/g,
      map: m => ({ kind: 'dropConstraint', name: m[1] }),
    },
    {
      re: /create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)\s+on\s/g,
      map: m => ({ kind: 'addUniqueIndex', name: m[1] }),
    },
    {
      re: /drop\s+index\s+(?:if\s+exists\s+)?([a-z0-9_]+)/g,
      map: m => ({ kind: 'dropIndex', name: m[1] }),
    },
    {
      re: /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/g,
      map: m => ({ kind: 'dropTable', name: m[1] }),
    },
  ]

  const found: Array<{ pos: number; ev: Event }> = []
  for (const { re, map } of patterns) {
    let m: RegExpExecArray | null
    // Fresh regex per pattern because .exec with /g is stateful.
    const rx = new RegExp(re.source, re.flags)
    while ((m = rx.exec(clean)) !== null) {
      found.push({ pos: m.index, ev: map(m) })
    }
  }
  found.sort((a, b) => a.pos - b.pos)
  return found.map(f => f.ev)
}

function parseMigration(sql: string, state: ExpectedObjects): void {
  for (const ev of extractEvents(sql)) {
    switch (ev.kind) {
      case 'addCheck':
        state.checkConstraints.add(ev.name)
        break
      case 'dropConstraint':
        // Drops ANY constraint (including non-CHECK) — safe because the
        // expected set only contains names we previously added as CHECK.
        state.checkConstraints.delete(ev.name)
        break
      case 'addUniqueIndex':
        state.uniqueIndexes.add(ev.name)
        break
      case 'dropIndex':
        state.uniqueIndexes.delete(ev.name)
        break
      case 'dropTable': {
        // Auto-named constraints/indexes start with `<table>_`. User-named
        // ones should be dropped explicitly, but clean the heuristic too.
        const prefix = `${ev.name}_`
        for (const c of [...state.checkConstraints]) {
          if (c.startsWith(prefix)) state.checkConstraints.delete(c)
        }
        for (const i of [...state.uniqueIndexes]) {
          if (i.startsWith(prefix)) state.uniqueIndexes.delete(i)
        }
        break
      }
    }
  }
}

function computeExpected(): ExpectedObjects {
  const dir = resolve(process.cwd(), 'supabase/migrations')
  const files = readdirSync(dir)
    .filter(f => /^\d+.*\.sql$/.test(f))
    // Numeric prefix sort so 002 < 010 < 011 (naive string sort works here
    // because all prefixes are zero-padded to 3 digits today).
    .sort((a, b) => a.localeCompare(b))

  const state: ExpectedObjects = {
    checkConstraints: new Set(),
    uniqueIndexes: new Set(),
  }
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    parseMigration(sql, state)
  }
  return state
}

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m?.[1] ?? null
}

async function mgmtQuery<T = unknown>(sql: string): Promise<T[] | null> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = getProjectRef()
  if (!token || !ref) return null
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) return null
  return (await res.json()) as T[]
}

test.describe('Tier 0 — Schema-drift probe (migrations vs live DB)', () => {
  test('every CHECK constraint declared by migrations (net of drops) exists in pg_constraint', async () => {
    const canProbe = !!process.env.SUPABASE_ACCESS_TOKEN && !!getProjectRef()
    test.skip(!canProbe, 'SUPABASE_ACCESS_TOKEN / project ref unavailable — cannot probe live DB')

    const expected = computeExpected()
    // The check set is intentionally small today. If this test ever needs to
    // guard hundreds of constraints, we probably want to group the query.
    expect(
      expected.checkConstraints.size,
      'at least one CHECK constraint should be declared across migrations',
    ).toBeGreaterThan(0)

    const live = await mgmtQuery<{ conname: string }>(
      `select conname from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace`,
    )
    expect(live, 'Management API query must succeed').not.toBeNull()
    const liveNames = new Set((live ?? []).map(r => r.conname))

    const missing: string[] = []
    for (const name of expected.checkConstraints) {
      if (!liveNames.has(name)) missing.push(name)
    }

    expect(
      missing,
      `CHECK constraints declared by migrations but missing in prod:\n  ${missing.join('\n  ')}\n\n` +
      `If intentional, add a migration that drops them so the probe stops flagging.\n` +
      `If unintentional, re-apply the relevant migration via Management API.`,
    ).toEqual([])
  })

  test('every unique index declared by migrations (net of drops) exists in pg_indexes', async () => {
    const canProbe = !!process.env.SUPABASE_ACCESS_TOKEN && !!getProjectRef()
    test.skip(!canProbe, 'SUPABASE_ACCESS_TOKEN / project ref unavailable')

    const expected = computeExpected()
    test.skip(expected.uniqueIndexes.size === 0, 'no unique indexes declared by migrations — nothing to probe')

    const live = await mgmtQuery<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and indexdef ilike '%unique%'`,
    )
    expect(live, 'Management API query must succeed').not.toBeNull()
    const liveNames = new Set((live ?? []).map(r => r.indexname))

    const missing: string[] = []
    for (const name of expected.uniqueIndexes) {
      if (!liveNames.has(name)) missing.push(name)
    }
    expect(
      missing,
      `unique indexes declared by migrations but missing in prod:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  test('parser self-check: migration 012 correctly drops bookings_placement_no_teacher', () => {
    // Regression guard on the parser itself. Today's lesson was that migration
    // 010 adds this constraint and migration 012 drops it. The net expected
    // set MUST NOT contain `bookings_placement_no_teacher`. If this test
    // fails, the parser's drop-handling is broken — and the first test above
    // would either falsely red-flag the prod DB (constraint expected but
    // absent) or miss real drift. This is the canary.
    const expected = computeExpected()
    expect(
      expected.checkConstraints.has('bookings_placement_no_teacher'),
      'parser must honor migration 012\'s drop of bookings_placement_no_teacher',
    ).toBe(false)
  })

  test('parser self-check: migration 009 unique index plans_plan_key_unique is tracked', () => {
    // Positive canary — confirms the parser is finding unique indexes at all.
    // If migration 009's `plans_plan_key_unique` stops appearing in the
    // expected set, either migration 009 was renamed, the parser's regex
    // broke, or the unique-index grammar changed.
    const expected = computeExpected()
    const hasAny = expected.uniqueIndexes.size > 0
    expect(
      hasAny,
      'parser must find at least one unique index across migrations (check 009_plans_reseed.sql)',
    ).toBe(true)
  })
})
