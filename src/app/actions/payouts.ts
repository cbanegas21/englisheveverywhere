'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Save (or update) the teacher's Veem payout email — where their cleared
// earnings are swept weekly. Self-update: verify the signed-in user owns the
// teacher row, then write via the admin client (mirrors updateTeacherProfile).
export async function saveTeacherVeemPayout(email: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const trimmed = (email || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) || trimmed.length > 254) {
    return { error: 'invalid_email' }
  }

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!teacher) return { error: 'not_a_teacher' }

  const { error } = await admin
    .from('teachers')
    .update({ payout_veem_email: trimmed, payout_setup_at: new Date().toISOString() })
    .eq('profile_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
