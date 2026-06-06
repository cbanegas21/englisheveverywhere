'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID: Record<string, string[]> = {
  learning_style: ['visual', 'auditory', 'reading', 'mixed'],
  self_rated_level: ['just_starting', 'getting_by', 'conversational', 'advanced', 'not_sure'],
  motivation: ['work', 'travel', 'study', 'personal', 'just_me'],
  availability: ['mornings', 'afternoons', 'evenings', 'late_night', 'varies'],
  speaking_comfort: ['nervous', 'depends', 'comfortable'],
}

export async function saveIntake(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const lang = (formData.get('lang') as string) || 'es'
  const learning_goal = (formData.get('learning_goal') as string)?.trim() || null
  const learning_style = (formData.get('learning_style') as string | null) || null
  const self_rated_level = (formData.get('self_rated_level') as string | null) || null
  const motivation = (formData.get('motivation') as string | null) || null
  const availability = (formData.get('availability') as string | null) || null
  const speaking_comfort = (formData.get('speaking_comfort') as string | null) || null

  for (const [field, val] of Object.entries({
    learning_style,
    self_rated_level,
    motivation,
    availability,
    speaking_comfort,
  })) {
    if (val && !VALID[field].includes(val)) return { error: `Invalid ${field}` }
  }

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
      learning_style,
      self_rated_level,
      motivation,
      availability,
      speaking_comfort,
      intake_done: true,
    })
    .eq('id', student.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')

  return { success: true, lang }
}
