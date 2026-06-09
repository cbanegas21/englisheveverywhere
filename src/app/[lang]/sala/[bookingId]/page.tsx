import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VideoRoomClient from './VideoRoomClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string; bookingId: string }>
}

export default async function VideoRoomPage({ params }: Props) {
  const { lang, bookingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // Preserve the room as the post-login destination so an email/SMS join link
  // lands the user straight in the call after they sign in (CALL-13).
  if (!user) {
    const next = encodeURIComponent(`/${lang}/sala/${bookingId}`)
    redirect(`/${lang}/login?next=${next}`)
  }

  // Fetch booking with participants via the service-role client (RLS-bypassing):
  // admins and admin-conductors aren't in the bookings SELECT policies, so a
  // user-scoped read returns null and strands them on a 404 before the
  // authorization branch below. Access is gated explicitly by the
  // isParticipant/isAdmin check, not by RLS visibility.
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, conductor_profile_id,
      teacher:teachers(profile_id, profile:profiles(full_name, avatar_url)),
      student:students(profile_id, profile:profiles(full_name, avatar_url))
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) notFound()

  const teacherProfileId = (booking.teacher as any)?.profile_id
  const studentProfileId = (booking.student as any)?.profile_id
  const conductorProfileId = (booking as any).conductor_profile_id

  // Participants (teacher / student / admin-conductor) always get through.
  // Non-participant admins get observer-style access for support — the
  // observer-only LiveKit grant (canPublish:false) is wired in
  // `actions/video.ts → getRoomAccess`.
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  const isAdmin = callerProfile?.role === 'admin'

  const isParticipant =
    user.id === teacherProfileId ||
    user.id === studentProfileId ||
    user.id === conductorProfileId

  if (!isParticipant && !isAdmin) {
    redirect(`/${lang}/dashboard`)
  }

  const isTeacher = user.id === teacherProfileId
  const myName = isTeacher
    ? (booking.teacher as any)?.profile?.full_name || 'Teacher'
    : user.id === studentProfileId
      ? (booking.student as any)?.profile?.full_name || 'Student'
      : `${callerProfile?.full_name || 'Admin'} (Admin)`
  const otherName = isTeacher
    ? (booking.student as any)?.profile?.full_name || 'Student'
    : (booking.teacher as any)?.profile?.full_name || 'Teacher'

  return (
    <VideoRoomClient
      lang={lang as Locale}
      bookingId={bookingId}
      scheduledAt={booking.scheduled_at}
      durationMinutes={booking.duration_minutes}
      isTeacher={isTeacher}
      myName={myName}
      otherName={otherName}
      status={booking.status}
    />
  )
}
