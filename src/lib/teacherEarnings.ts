// Canonical teacher-earnings math, shared by the teacher dashboard and the admin
// payout sweep so "available" agrees to the penny. Pure rule + one admin-client
// helper. The per-session payout rule mirrors phase 1: a settled payment row's
// teacher_payout_usd; $0 for a non-settled payment; hourly-rate fallback for a
// legacy completed booking with no payment row.

import type { SupabaseClient } from '@supabase/supabase-js'

// Earnings clear (become payable) this many days after the class — the hold that
// absorbs late refunds/no-shows before money is swept to the teacher's Veem.
export const HOLD_DAYS = 7

export function isClearedAt(scheduledAt: string, now = Date.now()): boolean {
  return new Date(scheduledAt).getTime() <= now - HOLD_DAYS * 24 * 60 * 60 * 1000
}

type PayRow = { teacher_payout_usd: number | null; status: string } | undefined
export function sessionPayoutUsd(pay: PayRow, durationMinutes: number | null, hourlyRate: number): number {
  if (pay) return pay.status === 'completed' ? (pay.teacher_payout_usd || 0) : 0
  return Math.round((hourlyRate || 0) * ((durationMinutes || 60) / 60))
}

export interface TeacherAvailable {
  availableUsd: number      // cleared earnings not yet committed to a payout
  clearedUsd: number        // all earnings past the hold
  pendingHoldUsd: number    // earnings still inside the hold window
  committedUsd: number      // sum of pending + paid payouts (already swept/owed)
  veemEmail: string | null
}

// THE source of truth for a teacher's payable balance. Uses the admin client
// (callers must authorize first). available = cleared − (pending + paid payouts).
export async function computeTeacherAvailable(
  admin: SupabaseClient,
  teacherId: string,
): Promise<TeacherAvailable> {
  const { data: teacher } = await admin
    .from('teachers')
    .select('hourly_rate, payout_veem_email')
    .eq('id', teacherId)
    .single()
  const rate = (teacher?.hourly_rate as number | null) || 0

  const { data: rows } = await admin
    .from('bookings')
    .select('scheduled_at, duration_minutes, payments(teacher_payout_usd, status)')
    .eq('teacher_id', teacherId)
    .eq('status', 'completed')

  const now = Date.now()
  let clearedUsd = 0
  let pendingHoldUsd = 0
  for (const r of (rows as { scheduled_at: string; duration_minutes: number | null; payments: PayRow[] | null }[] | null) || []) {
    const usd = sessionPayoutUsd(r.payments?.[0], r.duration_minutes, rate)
    if (isClearedAt(r.scheduled_at, now)) clearedUsd += usd
    else pendingHoldUsd += usd
  }

  const { data: payouts } = await admin
    .from('teacher_payouts')
    .select('amount_usd')
    .eq('teacher_id', teacherId)
    .in('status', ['pending', 'paid'])
  const committedUsd = (payouts || []).reduce((s, p) => s + Number((p as { amount_usd: number }).amount_usd || 0), 0)

  const availableUsd = Math.max(0, Math.round((clearedUsd - committedUsd) * 100) / 100)
  return { availableUsd, clearedUsd, pendingHoldUsd, committedUsd, veemEmail: teacher?.payout_veem_email ?? null }
}
