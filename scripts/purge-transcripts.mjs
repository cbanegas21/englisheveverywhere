/**
 * Purge old session transcripts for data-retention / privacy hygiene.
 *
 * Session transcripts (sessions.transcript) accumulate PII indefinitely. This
 * script nulls out `transcript` + `transcript_captured_at` for sessions whose
 * class ended more than RETENTION_DAYS ago, while KEEPING the session row
 * itself (booking/payment/accounting history stays intact).
 *
 * Runs via the Supabase Management API — same auth pattern as
 * scripts/dump-schema.mjs (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_ACCESS_TOKEN).
 * Intended to be invoked on a daily schedule by
 * .github/workflows/purge-transcripts.yml (Vercel Hobby caps cron at 1/day, so
 * we use GitHub Actions instead).
 *
 * Usage:
 *   node scripts/purge-transcripts.mjs --dry-run   # report only, no writes
 *   node scripts/purge-transcripts.mjs             # perform the purge
 *
 * Env:
 *   TRANSCRIPT_RETENTION_DAYS   override the 90-day default
 */

import { readFileSync } from 'node:fs'
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
  } catch { /* optional — env may come from CI secrets */ }
})()

const dryRun = process.argv.includes('--dry-run')
const retentionDays = Number(process.env.TRANSCRIPT_RETENTION_DAYS || 90)
if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  console.error(`purge-transcripts: invalid TRANSCRIPT_RETENTION_DAYS="${process.env.TRANSCRIPT_RETENTION_DAYS}"`)
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const accessToken = process.env.SUPABASE_ACCESS_TOKEN
if (!supabaseUrl || !accessToken) {
  console.error('purge-transcripts: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const ref = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
if (!ref) {
  console.error(`purge-transcripts: could not parse project ref from ${supabaseUrl}`)
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

// Only rows that actually still carry a transcript and are past the window.
const where = `ended_at is not null and ended_at < now() - interval '${retentionDays} days' and transcript is not null`

if (dryRun) {
  const rows = await query(`select count(*)::int as to_purge from public.sessions where ${where};`)
  const count = rows?.[0]?.to_purge ?? 0
  console.log(`purge-transcripts [DRY RUN]: ${count} transcript(s) older than ${retentionDays}d would be purged. No changes made.`)
  process.exit(0)
}

const rows = await query(`
  with purged as (
    update public.sessions
       set transcript = null, transcript_captured_at = null
     where ${where}
    returning id
  )
  select count(*)::int as purged from purged;
`)
const count = rows?.[0]?.purged ?? 0
console.log(`purge-transcripts: purged ${count} transcript(s) older than ${retentionDays}d.`)
