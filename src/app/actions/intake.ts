'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveIntake(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const lang = (formData.get('lang') as string) || 'es'
  const learning_goal    = (formData.get('learning_goal') as string)?.trim() || null
  const work_description = (formData.get('work_description') as string)?.trim() || null
  const learning_style   = formData.get('learning_style') as string | null
  const age_range        = formData.get('age_range') as string | null

  const validStyles = ['visual', 'auditory', 'reading', 'mixed']
  const validAges   = ['under_18', '18_25', '26_40', '40_plus']

  if (learning_style && !validStyles.includes(learning_style))
    return { error: 'Invalid learning style' }
  if (age_range && !validAges.includes(age_range))
    return { error: 'Invalid age range' }

  // Auth validated. Use admin client for writes (same RLS-edge fix as onboarding).
  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!student) return { error: 'Student profile not found' }

  const { error } = await admin
    .from('students')
    .update({
      learning_goal,
      work_description,
      learning_style,
      age_range,
      intake_done: true,
    })
    .eq('id', student.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')

  return { success: true, lang }
}
