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
// A class earns EXACTLY its settled payment row. No payment row → $0: with
// attendance-gated completion (migration 045) a completed booking with no payment
// is a NO-SHOW the teacher was correctly NOT paid for, so the old
// `!pay → hourlyRate*duration/60` fallback wrongly inflated earnings (a no-show
// showed up as full pay on the dashboard + in the available balance). Earnings now
// equal the payments ledger to the penny. (Prod has zero legitimate
// completed-without-payment rows, so removing the fallback changes no real earnings.)
export function sessionPayoutUsd(pay: PayRow): number {
  return pay && pay.status === 'completed' ? (pay.teacher_payout_usd || 0) : 0
}

export interface TeacherAvailable {
  availableUsd: number      // cleared earnings not yet committed to a payout
  clearedUsd: number        // all earnings past the hold
  pendingHoldUsd: number    // earnings still inside the hold window
  committedUsd: number      // sum of pending + paid payouts (already swept/owed)
  hasPendingPayout: boolean // a payout is already queued + unpaid for this teacher
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
    .select('payout_veem_email')
    .eq('id', teacherId)
    .single()

  const { data: rows } = await admin
    .from('bookings')
    .select('scheduled_at, duration_minutes, payments(teacher_payout_usd, status)')
    .eq('teacher_id', teacherId)
    .eq('status', 'completed')

  const now = Date.now()
  let clearedUsd = 0
  let pendingHoldUsd = 0
  for (const r of (rows as { scheduled_at: string; duration_minutes: number | null; payments: PayRow[] | null }[] | null) || []) {
    const usd = sessionPayoutUsd(r.payments?.[0])
    if (isClearedAt(r.scheduled_at, now)) clearedUsd += usd
    else pendingHoldUsd += usd
  }

  const { data: payouts } = await admin
    .from('teacher_payouts')
    .select('amount_usd, status')
    .eq('teacher_id', teacherId)
    .in('status', ['pending', 'paid'])
  const rowsP = (payouts || []) as { amount_usd: number; status: string }[]
  const committedUsd = rowsP.reduce((s, p) => s + Number(p.amount_usd || 0), 0)
  const hasPendingPayout = rowsP.some(p => p.status === 'pending')

  const availableUsd = Math.max(0, Math.round((clearedUsd - committedUsd) * 100) / 100)
  return { availableUsd, clearedUsd, pendingHoldUsd, committedUsd, hasPendingPayout, veemEmail: teacher?.payout_veem_email ?? null }
}
