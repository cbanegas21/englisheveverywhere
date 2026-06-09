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

// Expected charge in cents per plan, pinned from canonical pricing. The webhook
// compares amount_total against this before crediting so a non-standard /
// tampered / coupon'd session can't credit a pack for less than its price.
// Price IS already pinned at checkout-create via a fixed Stripe price ID, so the
// standard flow can't underpay — this closes the non-standard path (audit
// "webhook grants credits with NO amount-paid verification"). Legacy aliases are
// intentionally absent: no active checkout emits them and we have no pinned
// price to verify against, so they fail the amount check and are not credited.
const EXPECTED_CENTS: Record<string, number> = {
  spark: PRICING_MAP.spark.priceUsd * 100,
  drive: PRICING_MAP.drive.priceUsd * 100,
  ascent: PRICING_MAP.ascent.priceUsd * 100,
  peak: PRICING_MAP.peak.priceUsd * 100,
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

  // Track DB write failures so we can release the ledger claim and let Stripe
  // retry. Without this, a failing update after a successful ledger insert
  // would leave a paying customer with no credits AND no retry path (the next
  // retry would short-circuit as duplicate).
  let processingError: string | null = null

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

        // Verify the customer actually paid the right amount before crediting.
        // These are non-transient checks (a mismatch won't resolve on retry), so
        // they ack the event (break, ledger claim kept) rather than 500-retry.
        const paymentStatus = session.object.payment_status as string | undefined
        const mode = session.object.mode as string | undefined
        const currency = session.object.currency as string | undefined
        const amountTotal = session.object.amount_total as number | null | undefined

        // Paid, one-time, USD. EXPECTED_CENTS is pinned in USD cents — if the
        // account ever goes multi-currency, a non-USD session must be rejected
        // here rather than amount-compared against USD figures (mis-credit risk).
        if (paymentStatus !== 'paid' || mode !== 'payment' || currency !== 'usd') {
          console.error('[stripe webhook] checkout not a paid one-time USD payment — skipping credit', {
            userId, planKey, paymentStatus, mode, currency,
          })
          break
        }

        const expectedCents = EXPECTED_CENTS[planKey]
        if (expectedCents === undefined || amountTotal !== expectedCents) {
          console.error('[stripe webhook] amount_total does not match pinned plan price — skipping credit', {
            userId, planKey, amountTotal, expectedCents,
          })
          break
        }

        const { data: student, error: lookupErr } = await supabase
          .from('students')
          .select('id, classes_remaining')
          .eq('profile_id', userId)
          .maybeSingle()

        if (lookupErr) {
          processingError = `checkout student lookup failed: ${lookupErr.message}`
          break
        }
        if (!student) {
          // A checkout can complete moments before the students row exists (signup
          // race). Release the ledger claim and let Stripe retry so the credit is
          // not permanently lost; Stripe stops retrying after a few days if the row
          // never appears (logged above for manual reconciliation).
          processingError = `checkout student not found yet for user ${userId} (will retry)`
          break
        }

        // Grant credit AND set current_plan in ONE atomic statement
        // (add_classes_with_plan, SECURITY DEFINER, migration 034). Critical for
        // retry-safety: the ledger claim is released on ANY processingError, so a
        // split credit-then-plan could double-credit on Stripe's retry if the plan
        // update failed after the credit landed. One statement = all-or-nothing.
        const { error: creditErr } = await supabase.rpc('add_classes_with_plan', {
          p_student_id: student.id,
          p_count: classes,
          p_plan_key: planKey,
        })
        if (creditErr) {
          processingError = `checkout credit grant failed: ${creditErr.message}`
        }
      }
      break
    }

    case 'charge.refunded': {
      const charge = event.data as { object: Record<string, unknown> }
      const refunded = charge.object.amount_refunded as number
      const total = charge.object.amount as number
      // Guard against missing/null amounts coercing into a wrong full-refund verdict.
      if (typeof refunded !== 'number' || typeof total !== 'number' || total <= 0) {
        console.error('[stripe webhook] refund event has invalid amounts — skipping', { refunded, total })
        break
      }
      const isFullRefund = refunded >= total

      // Only reverse credits on full refund — partial refunds (e.g. a
      // goodwill credit) leave the class pack intact.
      if (isFullRefund) {
        const meta = (charge.object.metadata as Record<string, string> | null) ?? {}
        const userId = meta.user_id
        const planKey = meta.plan_key
        if (userId && planKey && CLASS_COUNTS[planKey]) {
          const { data: student, error: lookupErr } = await supabase
            .from('students')
            .select('id, classes_remaining')
            .eq('profile_id', userId)
            .maybeSingle()

          if (lookupErr) {
            processingError = `refund student lookup failed: ${lookupErr.message}`
            break
          }

          if (student) {
            const newCount = Math.max(0, (student.classes_remaining || 0) - CLASS_COUNTS[planKey])
            // Clear current_plan when the refund zeroes the balance — otherwise the
            // student is stuck showing a "current plan" with 0 classes and the
            // re-buy button for that plan stays disabled.
            const update: { classes_remaining: number; current_plan?: null } = { classes_remaining: newCount }
            if (newCount === 0) update.current_plan = null
            const { error: updateErr } = await supabase
              .from('students')
              .update(update)
              .eq('id', student.id)

            if (updateErr) {
              processingError = `refund credit decrement failed: ${updateErr.message}`
            }
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

  // Release the ledger claim on failure so Stripe's retry can re-process.
  // Doing this before the 500 response: deleting the row means the next
  // retry won't see a duplicate and can re-run the handler to completion.
  if (processingError) {
    console.error('[stripe webhook] processing failed, releasing ledger claim', {
      eventId: event.id,
      eventType: event.type,
      error: processingError,
    })
    await supabase
      .from('processed_stripe_events')
      .delete()
      .eq('id', event.id)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
