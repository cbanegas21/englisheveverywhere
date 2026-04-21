import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import IntakeClient from './IntakeClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function IntakePage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, intake_done, survey_answers')
    .eq('profile_id', user.id)
    .single()

  if (!student) redirect(`/${lang}/dashboard`)

  // If already done, send to scheduling
  if (student.intake_done) redirect(`/${lang}/dashboard/agendar`)

  // If student already filled placement survey, skip intake — same info already captured.
  // Persist intake_done=true so the agendar gate doesn't bounce them right back.
  if (student.survey_answers && Object.keys(student.survey_answers as object).length > 0) {
    const admin = createAdminClient()
    await admin.from('students').update({ intake_done: true }).eq('id', student.id)
    redirect(`/${lang}/dashboard/agendar`)
  }

  // If no classes yet, send to plan page to purchase first
  if ((student.classes_remaining || 0) <= 0) redirect(`/${lang}/dashboard/plan`)

  return <IntakeClient lang={lang as Locale} />
}
