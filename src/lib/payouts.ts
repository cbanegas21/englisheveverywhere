// Weekly teacher-payout sweep, shared by the admin action (manual button) and the
// scheduled cron (/api/cron/weekly-payouts) so both create identical pending rows.
// For every active teacher with a Veem email, snapshot their available (cleared −
// already-committed) balance into a 'pending' payout the admin then pays out
// wallet-to-wallet in Veem and marks paid. Min $1 (no dust). Idempotent-ish:
// re-running just finds $0 available (the prior pending counts as committed) or hits
// the one-pending-per-teacher unique index (23505 → skip).
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTeacherAvailable } from '@/lib/teacherEarnings'

export interface SweepResult {
  created: number
  totalUsd: number
  skipped: number
  errors: string[]
}

export async function sweepPayouts(admin: SupabaseClient): Promise<SweepResult> {
  const { data: teachers } = await admin
    .from('teachers')
    .select('id, payout_veem_email')
    .not('payout_veem_email', 'is', null)
    .eq('is_active', true)

  let created = 0
  let totalUsd = 0
  let skipped = 0
  const errors: string[] = []
  const now = new Date().toISOString()
  for (const t of (teachers as { id: string }[] | null) || []) {
    const { availableUsd, veemEmail, hasPendingPayout } = await computeTeacherAvailable(admin, t.id)
    if (!veemEmail || hasPendingPayout) { skipped++; continue }
    if (availableUsd < 1) continue
    const { error } = await admin.from('teacher_payouts').insert({
      teacher_id: t.id,
      amount_usd: availableUsd,
      veem_email: veemEmail,
      status: 'pending',
      period_end: now,
    })
    if (error) {
      if (error.code === '23505') { skipped++; continue } // one-pending-per-teacher race — benign
      errors.push(error.message)
      continue
    }
    created++
    totalUsd += availableUsd
  }
  return { created, totalUsd: Math.round(totalUsd * 100) / 100, skipped, errors }
}
