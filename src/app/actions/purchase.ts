'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'

export async function simulatePurchase(planKey: string, lang: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const plan = PLANS[planKey as PlanKey]
  if (!plan) return { error: 'Invalid plan' }

  const { data: student, error: fetchErr } = await supabase
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .single()

  if (fetchErr || !student) return { error: 'Student profile not found' }

  const newCount = (student.classes_remaining || 0) + plan.classes

  const { error: updateErr } = await supabase
    .from('students')
    .update({ classes_remaining: newCount })
    .eq('id', student.id)

  if (updateErr) return { error: updateErr.message }

  revalidatePath(`/${lang}/dashboard`)
  revalidatePath(`/${lang}/dashboard/plan`)
  revalidatePath(`/${lang}/dashboard/agendar`)

  return {
    success: true,
    classesAdded: plan.classes,
    newTotal: newCount,
    planName: plan.name,
  }
}
