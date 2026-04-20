import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VideoRoomClient from './VideoRoomClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string; bookingId: string }>
}

export default async function VideoRoomPage({ params }: Props) {
  const { lang, bookingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Fetch booking with participants
  const { data: booking } = await supabase
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
  // Admins get observer-style access for support. TODO: observer-mode — admins
  // currently receive full participant permissions; scope down once LiveKit's
  // observer role is wired in `actions/video.ts → getRoomAccess`.
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
