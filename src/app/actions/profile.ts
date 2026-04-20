'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface NotificationPreferences {
  email?: boolean
  sms?: boolean
  whatsapp?: boolean
  before24h?: boolean
  before1h?: boolean
}

export async function updateStudentProfile(data: {
  fullName?: string
  timezone?: string
  phone?: string | null
  avatarUrl?: string | null
  preferredLanguage?: 'es' | 'en'
  preferredCurrency?: string
  notificationPreferences?: NotificationPreferences
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (data.fullName !== undefined)             patch.full_name = data.fullName
  if (data.timezone !== undefined)             patch.timezone = data.timezone
  if (data.phone !== undefined)                patch.phone = data.phone
  if (data.avatarUrl !== undefined)            patch.avatar_url = data.avatarUrl
  if (data.preferredLanguage !== undefined)    patch.preferred_language = data.preferredLanguage
  if (data.preferredCurrency !== undefined) {
    const code = data.preferredCurrency.toUpperCase()
    if (code.length === 3) patch.preferred_currency = code
  }
  if (data.notificationPreferences !== undefined) {
    patch.notification_preferences = data.notificationPreferences
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
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

/**
 * Persist only the preferred currency. Called from useCurrency's onPersist hook
 * so the background sync doesn't interfere with anything else on the page.
 */
export async function savePreferredCurrency(code: string): Promise<{ success: boolean; error?: string }> {
  const clean = (code || '').toUpperCase().trim()
  if (clean.length !== 3) return { success: false, error: 'Invalid currency code' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const { error } = await supabase
    .from('profiles')
    .update({ preferred_currency: clean, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
