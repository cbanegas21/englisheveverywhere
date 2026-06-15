'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserActionLimit } from '@/lib/rateLimit'
import { revalidatePath } from 'next/cache'

// Save (or update) the teacher's Veem payout email — where their cleared
// earnings are swept weekly. Self-update: verify the signed-in user owns the
// teacher row, then write via the admin client (mirrors updateTeacherProfile).
export async function saveTeacherVeemPayout(email: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  // Per-user throttle (§7.4 AUTHZ-01) — generous; a teacher sets this rarely.
  // Allowlisted in auth_attempts.action by migration 049 (else a silent no-op).
  const rl = await checkUserActionLimit(user.id, 'saveTeacherVeemPayout', 10)
  if (!rl.ok) return { error: 'rate_limited' }

  const trimmed = (email || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) || trimmed.length > 254) {
    return { error: 'invalid_email' }
  }

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!teacher) return { error: 'not_a_teacher' }
  // A deactivated / not-yet-approved teacher must not change payout details
  // (mirrors updateTeacherProfile's is_active gate). They accrue $0 anyway.
  if (!teacher.is_active) return { error: 'not_active' }

  const { error } = await admin
    .from('teachers')
    .update({ payout_veem_email: trimmed, payout_setup_at: new Date().toISOString() })
    .eq('profile_id', user.id)
  if (error) {
    // 23505 = the partial unique index (migration 049): another teacher already
    // registered this Veem address. Allowing it would misdirect the weekly sweep
    // (one teacher's payout routed to the other's wallet). Friendly message.
    if (error.code === '23505') return { error: 'email_in_use' }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
