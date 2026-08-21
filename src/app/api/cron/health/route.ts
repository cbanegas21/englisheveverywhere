import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { probeAuth, probeDatabase } from '@/lib/health'

export const dynamic = 'force-dynamic'

// Scheduled health check + database keep-alive. Triggered by GitHub Actions
// (.github/workflows/db-keepalive.yml). Two jobs, both load-bearing:
//
//   KEEP-ALIVE — the daily data-API read resets Supabase's free-tier idle timer,
//   which is what auto-paused the production project in Aug 2026 (see
//   src/lib/health.ts for the full post-mortem). No other scheduled job issues a
//   guaranteed database request.
//
//   ALERTING — this route returns a NON-2xx when a plane is down, and the
//   workflow curls it with `-fsS`, so an outage turns the run red and GitHub
//   emails the owner. The previous crons all reported green through a four-week
//   total outage; a health check that can't fail is not a health check.
//
// Auth via the shared CRON_SECRET, fails CLOSED if unset (same as the other crons).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.endsWith('_placeholder')) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.endsWith('_placeholder')) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [db, auth] = await Promise.all([probeDatabase(), probeAuth()])
  const ok = db.ok && auth.ok

  if (!ok) {
    const failures = [
      db.ok ? null : `database: ${db.error}`,
      auth.ok ? null : `auth: ${auth.error}`,
    ].filter(Boolean).join(' | ')
    Sentry.captureMessage(
      `health: Supabase unreachable — the site cannot serve logins, bookings or checkout. ${failures}`,
      'fatal',
    )
  }

  return NextResponse.json(
    {
      ok,
      database: db.ok ? { up: true, ms: db.ms } : { up: false, ms: db.ms, error: db.error },
      auth: auth.ok ? { up: true, ms: auth.ms } : { up: false, ms: auth.ms, error: auth.error },
    },
    { status: ok ? 200 : 503 },
  )
}

export async function POST(req: NextRequest) { return run(req) }
export async function GET(req: NextRequest) { return run(req) }
