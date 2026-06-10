/**
 * Apply a SQL migration to the LIVE database via the Supabase Management API.
 * We do NOT use the `supabase` CLI (not installed here) or `supabase db push`
 * (would clobber the drifted schema). This runs the file's SQL as one query.
 *
 *   POST https://api.supabase.com/v1/projects/<ref>/database/query
 *   Authorization: Bearer <SUPABASE_ACCESS_TOKEN>   (from .env.local)
 *   body: { "query": "<sql>" }
 *
 * Usage: node scripts/apply-migration.mjs supabase/migrations/035_student_purchases.sql
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
      if (process.env[m[1]]) continue
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional in CI */ }
})()

const file = process.argv[2]
if (!file) { console.error('usage: node scripts/apply-migration.mjs <path-to-sql>'); process.exit(1) }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const accessToken = process.env.SUPABASE_ACCESS_TOKEN
if (!supabaseUrl || !accessToken) { console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN'); process.exit(1) }
const ref = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
if (!ref) { console.error(`could not parse project ref from ${supabaseUrl}`); process.exit(1) }

const sql = readFileSync(resolve(projectRoot, file), 'utf8')
console.log(`apply-migration: POST ${file} -> project ${ref} (${sql.length} chars)`)

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
if (!res.ok) { console.error(`apply-migration: HTTP ${res.status} ${res.statusText}\n${text}`); process.exit(1) }
console.log(`apply-migration: OK ${res.status}\n${text}`)
