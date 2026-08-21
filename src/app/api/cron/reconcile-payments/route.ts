import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { probeDatabase } from '@/lib/health'

export const dynamic = 'force-dynamic'

// Daily payment reconciliation (P1-3). Lists recent PAID Stripe checkout sessions
// and asserts each one recorded a student_purchases row (written right after the
// credit lands). A missing row = a paid customer who may not have been credited —
// alert so an operator can fix it, instead of discovering it via a complaint.
// Triggered by GitHub Actions (.github/workflows/reconcile-payments.yml). Auth via
// the shared CRON_SECRET; fails closed if unset.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.endsWith('_placeholder')) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.endsWith('_placeholder')) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.endsWith('_placeholder')) {
    Sentry.captureMessage('reconcile-payments: STRIPE_SECRET_KEY missing — cannot reconcile', 'error')
    return NextResponse.json({ error: 'stripe not configured' }, { status: 503 })
  }

  // Prove the database answers BEFORE reconciling. Without this the job reads as
  // healthy during a total outage: with zero paid sessions the loop below never
  // runs, so it returned {ok:true} every day of the Aug 2026 four-week pause.
  const db = await probeDatabase()
  if (!db.ok) {
    Sentry.captureMessage(
      `reconcile-payments: database unreachable — reconciliation did NOT run and paid-but-uncredited customers would go undetected. ${db.error}`,
      'fatal',
    )
    return NextResponse.json({ error: 'database unreachable', detail: db.error }, { status: 503 })
  }

  try {
    const Stripe = require('stripe')
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' })
    const admin = createAdminClient()
    const sinceSec = Math.floor(Date.now() / 1000) - 26 * 60 * 60 // look back ~26h (daily run + overlap)

    // One page (100) is ample at launch volume; log if we ever hit the cap.
    const sessions = await stripe.checkout.sessions.list({ created: { gte: sinceSec }, limit: 100 })
    if (sessions.has_more) {
      Sentry.captureMessage('reconcile-payments: >100 checkout sessions in 26h — reconciliation truncated, raise the page size', 'warning')
    }

    const paid = (sessions.data || []).filter((s: { payment_status?: string; metadata?: Record<string, string> | null }) =>
      s.payment_status === 'paid' && s.metadata?.user_id && s.metadata?.plan_key)

    const missing: string[] = []
    for (const s of paid as { id: string; metadata?: Record<string, string> | null }[]) {
      const { data: row } = await admin
        .from('student_purchases')
        .select('id')
        .eq('stripe_session_id', s.id)
        .maybeSingle()
      if (!row) missing.push(s.id)
    }

    if (missing.length) {
      Sentry.captureMessage(`reconcile-payments: ${missing.length} paid checkout(s) with NO purchase record (possible uncredited customers): ${missing.join(', ')}`, 'error')
    }
    return NextResponse.json({ ok: true, checked: paid.length, missing: missing.length, missingSessionIds: missing })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'cron/reconcile-payments' } })
    return NextResponse.json({ error: 'reconcile failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) { return run(req) }
export async function GET(req: NextRequest) { return run(req) }
