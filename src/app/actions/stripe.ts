'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PRICING_PLANS } from '@/lib/pricing'

// Lazy-load Stripe to avoid issues when key is placeholder
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.endsWith('_placeholder')) return null
  const Stripe = require('stripe')
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' })
}

// Map plan key → Stripe price ID env var
const STRIPE_PRICE_IDS: Record<string, string> = {
  spark:  process.env.STRIPE_PRICE_SPARK  || '',
  drive:  process.env.STRIPE_PRICE_DRIVE  || '',
  ascent: process.env.STRIPE_PRICE_ASCENT || '',
  peak:   process.env.STRIPE_PRICE_PEAK   || '',
}

const PLANS = Object.fromEntries(
  PRICING_PLANS.map(p => [
    p.key,
    { name: p.nameEn, price: p.priceUsd * 100, classes: p.classes, priceId: STRIPE_PRICE_IDS[p.key] },
  ])
)

export async function createCheckoutSession(planKey: string, lang: string = 'es') {
  // Validate the locale before interpolating it into redirect / success URLs
  // (Payments-LOW-lang-param) — anything but 'en' falls back to the default 'es'.
  const safeLang = lang === 'en' ? 'en' : 'es'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLang}/login`)

  const plan = PLANS[planKey as keyof typeof PLANS]
  if (!plan) return { error: safeLang === 'es' ? 'Plan inválido.' : 'Invalid plan.' }

  // Only a fully-onboarded student (a students row) may buy. Otherwise the
  // webhook can't find the row to credit, the customer is charged with no
  // classes and no auto-refund, and the event 500-retries for days
  // (NONSTUDENT-CHARGE). Teachers/admins are redirected away from the plan page
  // by the dashboard layout, but the action must enforce it independently.
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!student) {
    return {
      error: safeLang === 'es'
        ? 'Completa tu registro antes de comprar un plan.'
        : 'Finish setting up your account before buying a plan.',
    }
  }

  const stripe = getStripe()
  if (!stripe) {
    // Dev mode — just return a fake URL
    return { url: `/${safeLang}/dashboard/plan?success=1&plan=${planKey}` }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${appUrl}/${safeLang}/dashboard/plan?success=1&plan=${planKey}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${safeLang}/dashboard/plan?cancelled=1`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_key: planKey,
        lang: safeLang,
      },
      // Propagate the same metadata to the PaymentIntent → Charge. Without this,
      // payment-mode metadata lives only on the Session, so the charge.refunded
      // webhook (which reads charge.metadata) has nothing to key on and never
      // reverses class credits. See docs/AUDIT_TICKETS.md EK-004.
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          plan_key: planKey,
          lang: safeLang,
        },
      },
      customer_email: user.email,
    }, {
      // Dedupe rapid double-submits: one unique checkout session per
      // user+plan+minute (Payments-LOW-checkout-ratelimit). The minute bucket
      // lets a legitimate later re-purchase open a fresh session — a pure
      // user+plan key would permanently replay the first (possibly expired)
      // session. Re-clicking within the same minute returns the same session.
      idempotencyKey: `checkout_${user.id}_${planKey}_${Math.floor(Date.now() / 60000)}`,
    })

    return { url: session.url }
  } catch (err: unknown) {
    // Don't surface raw Stripe error text to the user (Payments-LOW-stripe-errors);
    // log it server-side and return a generic localized message.
    console.error('createCheckoutSession failed:', err)
    return {
      error: safeLang === 'es'
        ? 'No se pudo iniciar el pago. Inténtalo de nuevo.'
        : 'Could not start checkout. Please try again.',
    }
  }
}
