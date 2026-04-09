'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Auth guard ────────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden')
  return user
}

// ── Teacher actions ───────────────────────────────────────────────────────────

export async function approveTeacher(teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ is_active: true })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function rejectTeacher(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Delete teacher record first (FK cascade removes availability_slots)
  const { error: delError } = await admin
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (delError) throw new Error(delError.message)

  // Downgrade profile back to student so they can re-register
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'student' })
    .eq('id', profileId)

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/', 'layout')
}

export async function toggleTeacherActive(teacherId: string, isActive: boolean) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ is_active: isActive })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

// ── Booking actions ───────────────────────────────────────────────────────────

export async function assignAndConfirmBooking(bookingId: string, teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function setTeacherRate(teacherId: string, rate: number) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ hourly_rate: rate })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function cancelBooking(bookingId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
