'use server'

import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { PRICING_PLANS } from '@/lib/pricing'
import { APP_URL } from '@/lib/email'

const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

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
    // P0-2: in PRODUCTION a missing/placeholder STRIPE_SECRET_KEY must NEVER
    // fake-succeed — the old code returned a "?success=1" URL, so a misconfigured
    // deploy showed the student a success page having paid nothing and getting no
    // credit. Fail closed + alert loudly; only dev returns the fake URL.
    if (IS_PROD) {
      Sentry.captureMessage('createCheckoutSession: STRIPE_SECRET_KEY missing/placeholder in production — checkout disabled', 'fatal')
      console.error('[createCheckoutSession] STRIPE_SECRET_KEY missing/placeholder in PRODUCTION')
      return {
        error: safeLang === 'es'
          ? 'El pago no está disponible en este momento. Inténtalo más tarde.'
          : 'Payments are temporarily unavailable. Please try again later.',
      }
    }
    // Dev mode — just return a fake URL
    return { url: `/${safeLang}/dashboard/plan?success=1&plan=${planKey}` }
  }

  // P0-2: a missing/typo'd STRIPE_PRICE_* env var leaves priceId '' → Stripe would
  // throw a generic error indistinguishable from a transient failure, silently
  // breaking ONE plan. Validate + alert so a config slip is caught, not guessed.
  if (!plan.priceId || !plan.priceId.startsWith('price_')) {
    Sentry.captureMessage(`createCheckoutSession: missing/invalid Stripe price id for plan "${planKey}" (STRIPE_PRICE_${planKey.toUpperCase()})`, 'fatal')
    console.error(`[createCheckoutSession] invalid priceId for plan ${planKey}: "${plan.priceId}"`)
    return {
      error: safeLang === 'es'
        ? 'Este plan no está disponible en este momento. Inténtalo más tarde.'
        : 'This plan is temporarily unavailable. Please try again later.',
    }
  }

  // Centralized APP_URL (lib/email) falls back to the real domain, never
  // localhost — a drifted env var must not strand a PAID customer's
  // success_url on a dead localhost link.
  const appUrl = APP_URL

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
    // log it server-side, alert Sentry (lost-sale signal), return generic copy.
    console.error('createCheckoutSession failed:', err)
    Sentry.captureException(err, { tags: { area: 'checkout' }, extra: { planKey, userId: user.id } })
    return {
      error: safeLang === 'es'
        ? 'No se pudo iniciar el pago. Inténtalo de nuevo.'
        : 'Could not start checkout. Please try again.',
    }
  }
}
