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

// Localized, user-safe intake errors (ONBOARD-06). Raw Supabase errors are
// logged server-side, never reflected to the user.
const ITK_MSG = {
  notAuth: { es: 'No autenticado.', en: 'Not authenticated.' },
  invalid: { es: 'Selección inválida.', en: 'Invalid selection.' },
  studentNotFound: { es: 'No se encontró tu perfil de estudiante.', en: 'Student profile not found.' },
  saveFailed: { es: 'No se pudo guardar. Inténtalo de nuevo.', en: 'Could not save. Please try again.' },
} as const
const itk = (k: keyof typeof ITK_MSG, lang: string) => ITK_MSG[k][lang === 'en' ? 'en' : 'es']

export async function saveIntake(formData: FormData) {
  const lang = (formData.get('lang') as string) || 'es'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: itk('notAuth', lang) }

  // Cap the free-text goal — it's written to the DB and rendered back; an
  // unbounded blob is abuse/misuse (matches the 2000-char bound used elsewhere).
  const learning_goal = ((formData.get('learning_goal') as string)?.trim() || '').slice(0, 2000) || null
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
    if (val && !VALID[field].includes(val)) return { error: itk('invalid', lang) }
  }

  // Auth validated. Use admin client for writes (same RLS-edge fix as onboarding).
  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!student) return { error: itk('studentNotFound', lang) }

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

  if (error) {
    console.error('saveIntake update failed:', error.message)
    return { error: itk('saveFailed', lang) }
  }

  revalidatePath('/', 'layout')

  return { success: true, lang }
}
