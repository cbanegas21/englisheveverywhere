import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanClient from './PlanClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function PlanPage({ params }: Props) {
  const { lang } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const [{ data: student }, { data: profile }] = await Promise.all([
    supabase
      .from('students')
      .select('id, classes_remaining, intake_done, current_plan')
      .eq('profile_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('id', user.id)
      .single(),
  ])

  let subscription: {
    status: string | null
    current_period_end: string | null
  } | null = null

  if (student?.id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sub) subscription = { status: sub.status as string, current_period_end: sub.current_period_end as string | null }
  }

  return (
    <PlanClient
      lang={lang as Locale}
      currentPlan={(student?.current_plan as string) || null}
      subscriptionStatus={subscription?.status || null}
      renewalDate={subscription?.current_period_end || null}
      classesRemaining={student?.classes_remaining || 0}
      intakeDone={student?.intake_done ?? false}
      initialCurrency={(profile?.preferred_currency as string) || 'USD'}
    />
  )
}
