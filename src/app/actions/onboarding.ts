'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function completeStudentOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: 'Not authenticated' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: studentError } = await supabase
    .from('students')
    .upsert({
      profile_id: data.userId,
    }, { onConflict: 'profile_id' })

  if (studentError) return { success: false, error: studentError.message }

  revalidatePath(`/${data.preferredLanguage}/dashboard`)
  return { success: true }
}

export async function completeTeacherOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
  bio: string
  specializations: string[]
  certifications?: string[]
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: 'Not authenticated' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: teacherError } = await supabase
    .from('teachers')
    .upsert({
      profile_id: data.userId,
      bio: data.bio,
      specializations: data.specializations,
      certifications: data.certifications || [],
      hourly_rate: 0,
      is_active: false,
    }, { onConflict: 'profile_id' })

  if (teacherError) return { success: false, error: teacherError.message }

  revalidatePath(`/${data.preferredLanguage}/maestro/dashboard`)
  return { success: true }
}
