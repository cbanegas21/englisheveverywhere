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

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, intake_done, current_plan')
    .eq('profile_id', user.id)
    .single()

  return (
    <PlanClient
      lang={lang as Locale}
      currentPlan={(student?.current_plan as string) || null}
      subscriptionStatus={null}
      classesRemaining={student?.classes_remaining || 0}
      intakeDone={student?.intake_done ?? false}
    />
  )
}
