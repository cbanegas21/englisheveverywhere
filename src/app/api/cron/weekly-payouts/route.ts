import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { sweepPayouts } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

// Scheduled weekly teacher-payout sweep (P1-4). Triggered by GitHub Actions
// (.github/workflows/weekly-payouts.yml) so it doesn't need the Vercel Hobby cron.
// Auth: a shared CRON_SECRET in the Authorization header. Fails CLOSED if the
// secret is unset (never runs unauthenticated). Creates the same 'pending' payout
// rows as the admin button; the actual Veem transfer + mark-paid stays manual.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.endsWith('_placeholder')) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.endsWith('_placeholder')) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await sweepPayouts(createAdminClient())
    if (result.errors.length) {
      Sentry.captureMessage(`Weekly payout sweep finished with ${result.errors.length} error(s): ${result.errors.join('; ')}`, 'error')
    }
    Sentry.captureMessage(`Weekly payout sweep: created ${result.created} payout(s) totalling $${result.totalUsd}, skipped ${result.skipped}`, 'info')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'cron/weekly-payouts' } })
    return NextResponse.json({ error: 'sweep failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) { return run(req) }
export async function GET(req: NextRequest) { return run(req) }
