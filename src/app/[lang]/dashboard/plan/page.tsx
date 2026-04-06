import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanClient from './PlanClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

const classToPlanKey: Record<number, string> = { 4: 'starter', 8: 'estandar', 16: 'intensivo' }

export default async function PlanPage({ params }: Props) {
  const { lang } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, intake_done')
    .eq('profile_id', user.id)
    .single()

  const studentId = student?.id || ''

  // Fetch current subscription for plan label
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plans(classes_per_month)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  const planClasses = (subscription?.plans as { classes_per_month?: number } | null)?.classes_per_month
  const currentPlan = planClasses ? (classToPlanKey[planClasses] || null) : null

  return (
    <PlanClient
      lang={lang as Locale}
      currentPlan={currentPlan}
      subscriptionStatus={(subscription as any)?.status || null}
      classesRemaining={student?.classes_remaining || 0}
      intakeDone={student?.intake_done ?? false}
    />
  )
}
