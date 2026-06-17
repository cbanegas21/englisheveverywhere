import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
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
    // Dev mode — just return 200. In PRODUCTION this means a real paid event is
    // being silently dropped (P0-2/P1-3): alert loudly. Stripe dedupes retries so
    // this won't spam, and envCheck already flags it on boot.
    if (process.env.VERCEL_ENV === 'production') {
      Sentry.captureMessage('Stripe webhook hit with placeholder/missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY in production — events are being dropped', 'fatal')
    }
    return NextResponse.json({ received: true })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: { id: string; type: string; data: unknown }
  let stripe: any // eslint-disable-line @typescript-eslint/no-explicit-any

  try {
    const Stripe = require('stripe')
    stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' })
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
    Sentry.captureMessage(`Stripe webhook ledger insert failed (${event.type}): ${ledgerError.message}`, 'error')
    return NextResponse.json({ error: 'Ledger error' }, { status: 500 })
  }

  // Track DB write failures so we can release the ledger claim and let Stripe
  // retry. Without this, a failing update after a successful ledger insert
  // would leave a paying customer with no credits AND no retry path (the next
  // retry would short-circuit as duplicate).
  let processingError: string | null = null
  // Per-charge idempotency guard (separate from the per-EVENT ledger): a second
  // distinct full-refund OR dispute event for the SAME charge must not subtract the
  // pack credits twice. Tracked as a sentinel row in the same ledger table. Held
  // in a var so it can be released alongside the event claim if processing fails.
  let chargeGuardId: string | null = null

  // Wrap the handler so a malformed-but-signed payload (e.g. a null/string
  // data.object) can't throw past the ledger claim — an uncaught throw would 500
  // with the event already marked processed, so Stripe's retry hits the duplicate
  // branch and the event is permanently swallowed. On any throw we set
  // processingError, which releases the claim below and 500s for a clean retry.
  try {
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
          Sentry.captureMessage(`Stripe webhook: paid checkout with UNKNOWN plan_key "${planKey}" — not credited (user ${userId})`, 'error')
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
          Sentry.captureMessage(`Stripe webhook: amount_total ${amountTotal} != expected ${expectedCents} for plan "${planKey}" — not credited (user ${userId})`, 'error')
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
        } else {
          // Record the purchase for the student's billing history / receipts.
          // Idempotent via unique(stripe_session_id) so a Stripe retry can't
          // duplicate the receipt. DELIBERATELY non-blocking: the credit already
          // landed, so we do NOT set processingError here — doing so would release
          // the idempotency ledger and make Stripe retry, DOUBLE-crediting the
          // already-granted classes. A failed receipt insert only loses the
          // history row (logged below), never the classes.
          const sessionId = (session.object.id as string | undefined) || null
          // expectedCents is integer USD cents pinned from pricing.ts and already
          // verified === amount_total; /100 is exact for the whole-dollar plan
          // prices, and numeric(10,2) rounds to 2dp on insert regardless.
          const { error: purchaseErr } = await supabase.from('student_purchases').insert({
            student_id: student.id,
            plan_key: planKey,
            amount_usd: expectedCents / 100,
            classes_added: classes,
            stripe_session_id: sessionId,
          })
          if (purchaseErr && purchaseErr.code !== '23505') {
            console.error('[stripe webhook] purchase record insert failed:', purchaseErr.message)
            // Non-blocking (credit already landed) — warn so the missing receipt row is visible.
            Sentry.captureMessage(`Stripe webhook: credit granted but purchase-record insert failed for student ${student.id}: ${purchaseErr.message}`, 'warning')
          }
        }
      } else {
        // A paid checkout with no app metadata (e.g. a Stripe Payment Link or a
        // dashboard-created charge) can't be credited — log it for reconciliation
        // instead of silently dropping it (the unknown-plan / amount-mismatch
        // branches already log; this closes the no-metadata observability gap).
        console.error('[stripe webhook] checkout.session.completed missing user_id/plan_key metadata — no credit applied', {
          eventId: event.id, hasUserId: !!userId, hasPlanKey: !!planKey,
        })
        Sentry.captureMessage(`Stripe webhook: paid checkout ${event.id} missing user_id/plan_key metadata (Payment Link / dashboard charge?) — manual credit needed`, 'error')
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
        // Claim this charge's refund before reversing credits — a second distinct
        // full-refund event for the same charge then hits 23505 and is skipped.
        const chargeId = charge.object.id as string | undefined
        if (chargeId) {
          const { error: guardErr } = await supabase
            .from('processed_stripe_events')
            .insert({ id: `refund-${chargeId}`, event_type: 'refund-guard' })
          if (guardErr) {
            if (guardErr.code === '23505') break // already reversed this charge — don't double-subtract
            processingError = `refund guard insert failed: ${guardErr.message}`
            break
          }
          chargeGuardId = `refund-${chargeId}`
        }
        const meta = (charge.object.metadata as Record<string, string> | null) ?? {}
        const userId = meta.user_id
        const planKey = meta.plan_key
        if (userId && planKey && CLASS_COUNTS[planKey]) {
          const { data: student, error: lookupErr } = await supabase
            .from('students')
            .select('id')
            .eq('profile_id', userId)
            .maybeSingle()

          if (lookupErr) {
            processingError = `refund student lookup failed: ${lookupErr.message}`
            break
          }

          if (student) {
            // Atomic, floored decrement (+ clears current_plan at 0) in ONE
            // statement. The previous read-then-Math.max-write lost concurrent
            // booking/refund/grant updates between the read and the write
            // (AG-MONEY-09). decrement_classes_by is SECURITY DEFINER and
            // service_role-only (migration 043) — never browser-callable.
            const { error: decErr } = await supabase.rpc('decrement_classes_by', {
              p_student_id: student.id,
              p_count: CLASS_COUNTS[planKey],
            })
            if (decErr) {
              processingError = `refund credit decrement failed: ${decErr.message}`
            }
          }
        }
      }
      break
    }

    case 'charge.dispute.created': {
      // P1-1: a chargeback pulls the money back, so REVERSE the student's class
      // credits (mirrors the full-refund path) and alert an admin. The dispute
      // object carries the charge id but NOT the charge metadata, so retrieve the
      // charge to read user_id/plan_key. Idempotent per charge via a dispute-guard
      // sentinel so a later dispute.* event / retry can't double-subtract.
      const dispute = event.data as { object: Record<string, unknown> }
      const chargeId = dispute.object.charge as string | undefined
      const reason = dispute.object.reason as string | undefined
      const amount = dispute.object.amount as number | undefined
      Sentry.captureMessage(`Stripe DISPUTE opened — charge=${chargeId} reason=${reason} amount=${amount}. Reversing credits; review payout exposure.`, 'error')
      if (chargeId && stripe) {
        const { error: guardErr } = await supabase
          .from('processed_stripe_events')
          .insert({ id: `dispute-${chargeId}`, event_type: 'dispute-guard' })
        if (guardErr) {
          if (guardErr.code === '23505') break // already reversed this charge
          processingError = `dispute guard insert failed: ${guardErr.message}`
          break
        }
        chargeGuardId = `dispute-${chargeId}`
        try {
          const charge = await stripe.charges.retrieve(chargeId)
          const meta = (charge?.metadata as Record<string, string> | undefined) ?? {}
          const userId = meta.user_id
          const planKey = meta.plan_key
          if (userId && planKey && CLASS_COUNTS[planKey]) {
            const { data: student, error: lookupErr } = await supabase
              .from('students').select('id').eq('profile_id', userId).maybeSingle()
            if (lookupErr) { processingError = `dispute student lookup failed: ${lookupErr.message}`; break }
            if (student) {
              const { error: decErr } = await supabase.rpc('decrement_classes_by', {
                p_student_id: student.id,
                p_count: CLASS_COUNTS[planKey],
              })
              if (decErr) processingError = `dispute credit decrement failed: ${decErr.message}`
              else Sentry.captureMessage(`Stripe dispute: reversed ${CLASS_COUNTS[planKey]} credits for student ${student.id} (charge ${chargeId})`, 'warning')
            }
          } else {
            Sentry.captureMessage(`Stripe dispute on charge ${chargeId} has no user_id/plan_key metadata — manual credit reversal needed`, 'error')
          }
        } catch (e) {
          processingError = `dispute charge retrieve failed: ${e instanceof Error ? e.message : 'unknown'}`
        }
      }
      break
    }

    case 'charge.dispute.closed': {
      // Informational: if the dispute was WON the credits could be restored
      // manually. Alert so an admin can reconcile; no automatic action.
      const dispute = event.data as { object: Record<string, unknown> }
      Sentry.captureMessage(`Stripe dispute CLOSED — charge=${dispute.object.charge} status=${dispute.object.status}`, 'info')
      break
    }

    default:
      break
  }
  } catch (err: unknown) {
    processingError = `unhandled error processing ${event.type}: ${err instanceof Error ? err.message : 'unknown'}`
    console.error('[stripe webhook] handler threw', { eventId: event.id, eventType: event.type, err })
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
    // P1-3: surface money-path failures to Sentry. The signup-race "student not
    // found yet" self-heals on Stripe's retry, so flag it lower (warning) to avoid
    // alarm fatigue; everything else is a real error an operator must see.
    const level = /not found yet/.test(processingError) ? 'warning' : 'error'
    Sentry.captureMessage(`Stripe webhook processing failed (${event.type}): ${processingError}`, level)
    await supabase
      .from('processed_stripe_events')
      .delete()
      .eq('id', event.id)
    // Release the per-charge refund/dispute guard too, so the retry can re-apply the reversal.
    if (chargeGuardId) {
      await supabase.from('processed_stripe_events').delete().eq('id', chargeGuardId)
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
