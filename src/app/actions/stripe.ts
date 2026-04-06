'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Lazy-load Stripe to avoid issues when key is placeholder
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'sk_test_placeholder') return null
  const Stripe = require('stripe')
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' })
}

const PLANS = {
  starter: { name: 'Starter', price: 3900, classes: 4, priceId: process.env.STRIPE_PRICE_STARTER || '' },
  estandar: { name: 'Estándar', price: 6900, classes: 8, priceId: process.env.STRIPE_PRICE_STANDARD || '' },
  intensivo: { name: 'Intensivo', price: 11900, classes: 16, priceId: process.env.STRIPE_PRICE_INTENSIVE || '' },
}

export async function createCheckoutSession(planKey: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const plan = PLANS[planKey as keyof typeof PLANS]
  if (!plan) return { error: 'Invalid plan' }

  const stripe = getStripe()
  if (!stripe) {
    // Dev mode — just return a fake URL
    return { url: `/${lang}/dashboard/plan?success=1&plan=${planKey}` }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${appUrl}/${lang}/dashboard/plan?success=1&plan=${planKey}`,
      cancel_url: `${appUrl}/${lang}/dashboard/plan?cancelled=1`,
      metadata: {
        user_id: user.id,
        plan_key: planKey,
        lang,
      },
      customer_email: user.email,
    })

    return { url: session.url }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error'
    return { error: msg }
  }
}

export async function createStripeConnectLink(lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const stripe = getStripe()
  if (!stripe) {
    return { url: 'https://connect.stripe.com/setup/c/placeholder' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // Get or create Stripe Connect account
    const { data: teacher } = await supabase
      .from('teachers')
      .select('stripe_account_id')
      .eq('profile_id', user.id)
      .single()

    let accountId = (teacher as any)?.stripe_account_id

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
    const msg = err instanceof Error ? err.message : 'Stripe Connect error'
    return { error: msg }
  }
}
