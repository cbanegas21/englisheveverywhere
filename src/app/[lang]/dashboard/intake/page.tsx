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

    // ONBOARD-05: best-effort map the placement survey answers into the structured
    // intake columns so the learning profile isn't left blank when intake is
    // skipped. Placement and intake use DIFFERENT question ids/values, so only
    // fields with a clear semantic correspondence are written — ambiguous ones
    // (placement 'style' speaking/writing, time-of-day availability, study
    // frequency/pace) stay null rather than storing a guess.
    const sa = student.survey_answers as Record<string, unknown>
    const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
    const firstOf = (v: unknown): string | undefined =>
      Array.isArray(v) ? (typeof v[0] === 'string' ? v[0] : undefined) : asStr(v)

    const LEVEL_MAP: Record<string, string> = { zero: 'just_starting', beginner: 'just_starting', elementary: 'getting_by', intermediate: 'conversational', advanced: 'advanced' }
    const SPEAKING_MAP: Record<string, string> = { yes: 'comfortable', a_little: 'depends', not_really: 'nervous', not_at_all: 'nervous' }
    const STYLE_MAP: Record<string, string> = { listening: 'auditory', reading: 'reading', mixed: 'mixed' }
    const MOTIVATION_MAP: Record<string, string> = { work: 'work', travel: 'travel', studies: 'study', growth: 'personal', emigrate: 'personal', other: 'just_me' }

    const patch: Record<string, unknown> = { intake_done: true }
    const lvl = asStr(sa.level); if (lvl && LEVEL_MAP[lvl]) patch.self_rated_level = LEVEL_MAP[lvl]
    const spk = asStr(sa.speaking); if (spk && SPEAKING_MAP[spk]) patch.speaking_comfort = SPEAKING_MAP[spk]
    const sty = asStr(sa.style); if (sty && STYLE_MAP[sty]) patch.learning_style = STYLE_MAP[sty]
    const mot = firstOf(sa.goals); if (mot && MOTIVATION_MAP[mot]) patch.motivation = MOTIVATION_MAP[mot]
    const notes = asStr(sa.notes); if (notes && notes.trim()) patch.learning_goal = notes.trim().slice(0, 2000)

    await admin.from('students').update(patch).eq('id', student.id)
    redirect(`/${lang}/dashboard/agendar`)
  }

  // If no classes yet, send to plan page to purchase first
  if ((student.classes_remaining || 0) <= 0) redirect(`/${lang}/dashboard/plan`)

  return <IntakeClient lang={lang as Locale} />
}
