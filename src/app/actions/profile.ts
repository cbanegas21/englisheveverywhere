'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateStudentProfile(data: {
  fullName: string
  timezone: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.fullName, timezone: data.timezone, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateTeacherProfile(data: {
  fullName: string
  bio: string
  specializations: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: data.fullName, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (profileError) return { success: false, error: profileError.message }

  const specs = data.specializations
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const { error: teacherError } = await supabase
    .from('teachers')
    .update({ bio: data.bio, specializations: specs })
    .eq('profile_id', user.id)

  if (teacherError) return { success: false, error: teacherError.message }
  return { success: true }
}
