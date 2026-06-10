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

export async function createStripeConnectLink(lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Defense in depth: verify the caller's profile role is 'teacher' BEFORE
  // doing anything Stripe-side. Without this, a student session could
  // trigger stripe.accounts.create on the next call and create an orphan
  // Stripe Connect account tied to their email. The downstream `!teacher`
  // teachers-table check is a second guard, not the primary one.
  // Regression-tested by tests/e2e/server-action-authz.spec.ts.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    return {
      error: lang === 'es'
        ? 'Solo los maestros pueden configurar pagos.'
        : 'Only teachers can set up payouts.',
    }
  }

  const stripe = getStripe()
  if (!stripe) {
    return { url: 'https://connect.stripe.com/setup/c/placeholder' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('stripe_account_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!teacher) return { error: lang === 'es' ? 'Solo los maestros pueden configurar pagos.' : 'Only teachers can set up payouts.' }

    let accountId = (teacher as any).stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id

      // Save account ID
      await supabase
        .from('teachers')
        .update({ stripe_account_id: accountId })
        .eq('profile_id', user.id)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/${lang}/maestro/dashboard/ganancias`,
      return_url: `${appUrl}/${lang}/maestro/dashboard/ganancias?connected=1`,
      type: 'account_onboarding',
    })

    return { url: accountLink.url }
  } catch (err: unknown) {
    // Generic localized message; the raw Stripe error is logged server-side only.
    console.error('createStripeConnectLink failed:', err)
    return {
      error: lang === 'es'
        ? 'No se pudo conectar con Stripe. Inténtalo de nuevo.'
        : 'Could not connect to Stripe. Please try again.',
    }
  }
}

// Connect onboarding status for the signed-in teacher's payouts (TE-04). Reads
// the teacher's OWN stripe_account_id, then asks Stripe whether the account has
// finished onboarding + can receive payouts. Degrades gracefully: no account →
// not connected; dev/placeholder keys or a Stripe error → treat as "set up but
// status unknown" (hasAccount true, flags false) so the UI prompts to finish.
export async function getTeacherPayoutStatus(): Promise<{
  hasAccount: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}> {
  const NONE = { hasAccount: false, payoutsEnabled: false, detailsSubmitted: false }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NONE

  const { data: teacher } = await supabase
    .from('teachers')
    .select('stripe_account_id')
    .eq('profile_id', user.id)
    .maybeSingle()
  const accountId = (teacher as { stripe_account_id?: string | null } | null)?.stripe_account_id
  if (!accountId) return NONE

  const stripe = getStripe()
  if (!stripe) return { hasAccount: true, payoutsEnabled: false, detailsSubmitted: false }

  try {
    const acct = await stripe.accounts.retrieve(accountId)
    return {
      hasAccount: true,
      payoutsEnabled: !!acct.payouts_enabled,
      detailsSubmitted: !!acct.details_submitted,
    }
  } catch (err) {
    console.error('getTeacherPayoutStatus failed:', err)
    return { hasAccount: true, payoutsEnabled: false, detailsSubmitted: false }
  }
}
