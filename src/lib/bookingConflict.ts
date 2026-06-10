import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * True if the student already has an active (non-cancelled) booking whose time
 * window overlaps [startIso, startIso + durationMinutes).
 *
 * Replaces the old exact-timestamp equality check (BOOKING-05): two classes that
 * START at different minutes but OVERLAP (e.g. an admin-created 9:30 class vs a
 * 9:00 class) went undetected before. Overlap = another booking starts before our
 * end AND ends after our start. The lookback is bounded (max class duration is far
 * under 6h) so the query stays small without missing a real overlap.
 *
 * Pass `excludeBookingId` when rescheduling so the booking being moved doesn't
 * conflict with itself.
 */
export async function studentHasTimeConflict(
  admin: SupabaseClient,
  studentId: string,
  startIso: string,
  durationMinutes: number,
  excludeBookingId?: string,
): Promise<boolean> {
  const start = new Date(startIso).getTime()
  if (Number.isNaN(start)) return false // caller validates dates; nothing to compare
  const end = start + durationMinutes * 60_000
  const windowStartIso = new Date(start - 6 * 60 * 60 * 1000).toISOString()
  const endIso = new Date(end).toISOString()

  let query = admin
    .from('bookings')
    .select('id, scheduled_at, duration_minutes')
    .eq('student_id', studentId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', windowStartIso)
    .lt('scheduled_at', endIso) // candidates that start strictly before our end
  if (excludeBookingId) query = query.neq('id', excludeBookingId)

  const { data } = await query
  for (const b of (data || []) as { scheduled_at: string; duration_minutes: number | null }[]) {
    const bStart = new Date(b.scheduled_at).getTime()
    const bEnd = bStart + (b.duration_minutes || 60) * 60_000
    if (bStart < end && bEnd > start) return true
  }
  return false
}
