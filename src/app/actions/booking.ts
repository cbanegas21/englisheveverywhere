'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function sendAdminBookingEmail(params: {
  bookingId: string
  studentName: string
  studentEmail: string
  teacherName: string
  scheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englisheverywhere.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!apiKey || apiKey === 're_placeholder') return // Skip silently if not configured

  const scheduled = new Date(params.scheduledAt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@englisheverywhere.com',
      to: adminEmail,
      subject: `New booking request — ${params.studentName}`,
      html: `
        <p>A new class booking has been submitted and requires your review.</p>
        <table>
          <tr><td><strong>Student</strong></td><td>${params.studentName} (${params.studentEmail})</td></tr>
          <tr><td><strong>Teacher</strong></td><td>${params.teacherName}</td></tr>
          <tr><td><strong>Scheduled</strong></td><td>${scheduled}</td></tr>
        </table>
        <p>
          <a href="${appUrl}/${params.lang}/admin/bookings">
            Review and confirm this booking →
          </a>
        </p>
      `,
    }),
  }).catch(() => {}) // Never let email failure break the booking
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const teacherId = formData.get('teacher_id') as string
  const scheduledAt = formData.get('scheduled_at') as string
  const durationMinutes = parseInt(formData.get('duration_minutes') as string) || 50
  const lang = (formData.get('lang') as string) || 'es'

  // ── 24-hour advance notice enforcement ───────────────────────
  const scheduledDate = new Date(scheduledAt)
  const minAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (scheduledDate < minAllowed) {
    return {
      error: lang === 'es'
        ? 'Las reservas requieren al menos 24 horas de anticipación.'
        : 'Bookings require at least 24 hours advance notice.',
    }
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .single()

  if (!student) return { error: 'Student profile not found' }
  if (student.classes_remaining <= 0) {
    return {
      error: lang === 'es'
        ? 'No tienes clases disponibles. Adquiere un plan.'
        : 'No classes remaining. Get a plan.',
    }
  }

  // ── Conflict check ───────────────────────────────────────────
  const { data: conflicting } = await supabase
    .from('bookings')
    .select('id')
    .eq('student_id', student.id)
    .eq('scheduled_at', scheduledAt)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (conflicting) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // ── Create booking ────────────────────────────────────────────
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      student_id: student.id,
      teacher_id: teacherId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      status: 'pending',
      type: 'class',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // ── Atomic decrement classes_remaining ───────────────────────
  await supabase.rpc('decrement_classes', { p_student_id: student.id })

  // ── Notify admin via email (non-blocking) ────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: teacherProfile } = await supabase
    .from('teachers')
    .select('profile:profiles(full_name)')
    .eq('id', teacherId)
    .single()

  sendAdminBookingEmail({
    bookingId: booking.id,
    studentName: profile?.full_name || user.email || 'Student',
    studentEmail: user.email || '',
    teacherName: (teacherProfile?.profile as any)?.full_name || 'Teacher',
    scheduledAt,
    lang,
  })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

export async function confirmBooking(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function declineBooking(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  // Fetch student_id before cancelling so we can restore their class
  const { data: booking } = await supabase
    .from('bookings')
    .select('student_id')
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)
    .single()

  if (!booking) return { error: 'Booking not found' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)

  if (error) return { error: error.message }

  // Restore the student's class
  await supabase.rpc('increment_classes', { p_student_id: booking.student_id })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function saveAvailabilitySlots(
  slots: { day_of_week: number; start_time: string; end_time: string }[],
  lang: string = 'es'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  // Delete existing recurring slots
  await supabase
    .from('availability_slots')
    .delete()
    .eq('teacher_id', teacher.id)

  if (slots.length === 0) {
    revalidatePath('/', 'layout')
    return { success: true }
  }

  const toInsert = slots.map((s) => ({
    teacher_id: teacher.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  }))

  const { error } = await supabase.from('availability_slots').insert(toInsert)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
