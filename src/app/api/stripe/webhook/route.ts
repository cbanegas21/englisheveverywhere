import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PRICING_MAP } from '@/lib/pricing'

// Canonical class counts per plan — sourced from src/lib/pricing.ts so a
// plan-definition change in one place propagates to Stripe webhook crediting.
// Legacy keys (starter/estandar/intensivo) retained as aliases so in-flight
// Stripe checkouts from older metadata still credit correctly.
const CLASS_COUNTS: Record<string, number> = {
  spark: PRICING_MAP.spark.classes,
  drive: PRICING_MAP.drive.classes,
  ascent: PRICING_MAP.ascent.classes,
  peak: PRICING_MAP.peak.classes,
  // Legacy — point old keys to the nearest current tier
  starter: PRICING_MAP.spark.classes,
  estandar: PRICING_MAP.drive.classes,
  intensivo: PRICING_MAP.ascent.classes,
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY

  if (!webhookSecret || webhookSecret.endsWith('_placeholder') || !stripeKey || stripeKey.endsWith('_placeholder')) {
    // Dev mode — just return 200
    return NextResponse.json({ received: true })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: { id: string; type: string; data: unknown }

  try {
    const Stripe = require('stripe')
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' })
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 })
  }

  // Webhook requests carry no user cookies — SSR client would hit RLS and
  // silently no-op. Use the service-role admin client for all writes.
  const supabase = createAdminClient()

  // Idempotency — insert event.id into the ledger BEFORE processing. Stripe
  // retries failed/slow webhooks with the same id; a retry after a partial
  // success must not re-apply credits. The PRIMARY KEY on event.id means a
  // racing retry that loses gets a 23505 (unique violation) and returns the
  // duplicate-ack branch. This is the atomic "claim this event" step.
  const { error: ledgerError } = await supabase
    .from('processed_stripe_events')
    .insert({ id: event.id, event_type: event.type })

  if (ledgerError) {
    // Postgres unique-violation code — event already processed.
    if (ledgerError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[stripe webhook] ledger insert failed', ledgerError)
    return NextResponse.json({ error: 'Ledger error' }, { status: 500 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data as { object: Record<string, unknown> }
      const metadata = session.object.metadata as Record<string, string> | null
      const userId = metadata?.user_id
      const planKey = metadata?.plan_key

      if (userId && planKey) {
        const classes = CLASS_COUNTS[planKey]
        if (!classes) {
          console.error('[stripe webhook] unknown plan_key in checkout metadata', { userId, planKey })
          break
        }

        const { data: student } = await supabase
          .from('students')
          .select('id, classes_remaining')
          .eq('profile_id', userId)
          .maybeSingle()

        if (!student) {
          console.error('[stripe webhook] student not found for checkout', { userId, planKey })
          break
        }

        // Increment rather than set — a student who still has leftover
        // credits from a prior purchase must not lose them when they
        // buy another pack. Matches simulatePurchase behavior.
        const newCount = (student.classes_remaining || 0) + classes

        await supabase
          .from('students')
          .update({ classes_remaining: newCount, current_plan: planKey })
          .eq('id', student.id)
      }
      break
    }

    case 'charge.refunded': {
      const charge = event.data as { object: Record<string, unknown> }
      const refunded = charge.object.amount_refunded as number
      const total = charge.object.amount as number
      const isFullRefund = refunded >= total

      // Only reverse credits on full refund — partial refunds (e.g. a
      // goodwill credit) leave the class pack intact.
      if (isFullRefund) {
        const meta = (charge.object.metadata as Record<string, string> | null) ?? {}
        const userId = meta.user_id
        const planKey = meta.plan_key
        if (userId && planKey && CLASS_COUNTS[planKey]) {
          const { data: student } = await supabase
            .from('students')
            .select('id, classes_remaining')
            .eq('profile_id', userId)
            .maybeSingle()
          if (student) {
            const newCount = Math.max(0, (student.classes_remaining || 0) - CLASS_COUNTS[planKey])
            await supabase
              .from('students')
              .update({ classes_remaining: newCount })
              .eq('id', student.id)
          }
        }
      }
      break
    }

    case 'charge.dispute.created':
    case 'charge.dispute.closed': {
      // No automatic action — surface via alerting later. Logging here so
      // the dashboard at least records that the event arrived.
      console.warn('[stripe webhook] dispute event', event.type, event.data)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
