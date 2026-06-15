import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanClient, { type Purchase } from './PlanClient'
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
    .maybeSingle()
  // No students row = onboarding unfinished. Don't render Pay buttons — a charge
  // with no students row can't be credited (NONSTUDENT-CHARGE); finish setup first.
  if (!student) redirect(`/${lang}/onboarding`)

  const [{ data: profile }, { data: purchasesRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('id', user.id)
      .maybeSingle(),
    // Real billing history for THIS surface — the panel previously rendered a
    // hardcoded "no payments yet" even for paying students (BILLING-PANEL-INVISIBLE).
    supabase
      .from('student_purchases')
      .select('id, plan_key, amount_usd, classes_added, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  return (
    <PlanClient
      lang={lang as Locale}
      currentPlan={(student.current_plan as string) || null}
      classesRemaining={student.classes_remaining || 0}
      intakeDone={student.intake_done ?? false}
      initialCurrency={(profile?.preferred_currency as string) || 'USD'}
      purchases={(purchasesRaw as Purchase[] | null) || []}
    />
  )
}
