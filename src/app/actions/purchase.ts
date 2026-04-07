'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'

export async function simulatePurchase(planKey: string, lang: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/${lang}/login`)

  const plan = PLANS[planKey as PlanKey]
  if (!plan) return { error: 'Invalid plan' }

  // Fetch or auto-create the student record
  let { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user!.id)
    .maybeSingle()

  if (!student) {
    const { data: created, error: createErr } = await supabase
      .from('students')
      .insert({ profile_id: user!.id, classes_remaining: 0 })
      .select('id, classes_remaining')
      .single()
    if (createErr || !created) return {
      error: lang === 'es' ? 'Error al crear tu perfil de estudiante.' : 'Error creating student profile.',
    }
    student = created
  }

  const newCount = (student.classes_remaining || 0) + plan.classes

  const { error: updateErr } = await supabase
    .from('students')
    .update({ classes_remaining: newCount, current_plan: planKey })
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
