import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CLASS_COUNTS: Record<string, number> = {
  starter: 4,
  estandar: 8,
  intensivo: 16,
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY

  if (!webhookSecret || webhookSecret === 'whsec_placeholder' || !stripeKey || stripeKey === 'sk_test_placeholder') {
    // Dev mode — just return 200
    return NextResponse.json({ received: true })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Record<string, unknown>

  try {
    const Stripe = require('stripe')
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' })
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 })
  }

  const supabase = await createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data as { object: Record<string, unknown> }
      const metadata = session.object.metadata as Record<string, string> | null
      const userId = metadata?.user_id
      const planKey = metadata?.plan_key

      if (userId && planKey) {
        const classes = CLASS_COUNTS[planKey] || 4

        // Get student record
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', userId)
          .single()

        // Get plan record by classes count
        const { data: plan } = await supabase
          .from('plans')
          .select('id')
          .eq('classes_per_month', classes)
          .single()

        if (student && plan) {
          const stripeSubId = session.object.subscription as string | null

          // Upsert subscription using stripe_subscription_id as conflict key
          await supabase.from('subscriptions').upsert({
            student_id: student.id,
            plan_id: plan.id,
            status: 'active',
            stripe_subscription_id: stripeSubId,
            current_period_start: new Date().toISOString(),
          }, { onConflict: 'stripe_subscription_id' })

          // Update student classes remaining
          await supabase
            .from('students')
            .update({ classes_remaining: classes })
            .eq('id', student.id)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data as { object: Record<string, unknown> }
      const stripeSubId = sub.object.id as string

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', stripeSubId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data as { object: Record<string, unknown> }
      const stripeSubId = invoice.object.subscription as string

      await supabase
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', stripeSubId)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
