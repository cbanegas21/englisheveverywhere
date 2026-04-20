'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { AccessToken } from 'livekit-server-sdk'

export interface SessionSummary {
  covered: string[]
  nextTopics: string[]
  progressNote: string
}

export async function getRoomAccess(bookingId: string): Promise<
  { url: string; token: string; sessionId: string; isDevMode: boolean } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, conductor_profile_id,
      teacher:teachers(profile_id, profile:profiles(full_name)),
      student:students(profile_id, profile:profiles(full_name))
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found' }

  const teacherProfileId = (booking.teacher as any)?.profile_id
  const studentProfileId = (booking.student as any)?.profile_id
  const conductorProfileId = (booking as any).conductor_profile_id

  // Admins may join any room (for support / observation / placement conducting).
  // TODO: observer-mode — admins currently get full publish permissions; wire a
  // read-only grant once LiveKit's observer role is configured.
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
    return { error: 'Not authorized for this booking' }
  }

  if (booking.status === 'cancelled') {
    return { error: 'This session has been cancelled' }
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.LIVEKIT_URL
  const isDevMode = !apiKey || !apiSecret || !wsUrl

  // Timing window — Zoom-style lobby. Participants may enter at any time;
  // the client renders a countdown lobby if `now < scheduled_at`. We only
  // gate the LATE cap here (session expires 90 min after the scheduled end).
  if (!isDevMode) {
    const now = Date.now()
    const scheduled = new Date(booking.scheduled_at).getTime()
    const durationMs = (booking.duration_minutes ?? 60) * 60 * 1000
    const closeAt = scheduled + durationMs + 90 * 60 * 1000
    if (now > closeAt) {
      return { error: 'This session has expired.' }
    }
  }

  // Create or get session record
  const adminClient = createAdminClient()
  const { data: existingSession } = await adminClient
    .from('sessions')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  let sessionId: string
  if (existingSession?.id) {
    sessionId = existingSession.id
  } else {
    const { data: newSession, error: sessionError } = await adminClient
      .from('sessions')
      .insert({ booking_id: bookingId, started_at: new Date().toISOString() })
      .select('id')
      .single()

    if (sessionError || !newSession) {
      return { error: 'Failed to initialize session record' }
    }
    sessionId = newSession.id
  }

  if (isDevMode) {
    return { url: '', token: '', sessionId, isDevMode: true }
  }

  // Generate LiveKit access token
  const roomName = `session-${bookingId}`
  const isTeacher = user.id === teacherProfileId
  const isStudent = user.id === studentProfileId
  const participantName = isTeacher
    ? (booking.teacher as any)?.profile?.full_name || 'Teacher'
    : isStudent
      ? (booking.student as any)?.profile?.full_name || 'Student'
      : isAdmin
        ? `${callerProfile?.full_name || 'Admin'} (Admin)`
        : 'Observer'

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participantName,
      ttl: 7200, // 2 hours
    })

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const token = await at.toJwt()
    return { url: wsUrl, token, sessionId, isDevMode: false }
  } catch {
    return { error: 'Failed to generate room access token' }
  }
}

export async function saveSessionNotes(sessionId: string, notes: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('sessions')
    .update({ notes })
    .eq('id', sessionId)

  return { success: !error }
}

async function generateSessionSummary(sessionId: string, lang: string): Promise<SessionSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const adminClient = createAdminClient()
  const { data: session } = await adminClient
    .from('sessions')
    .select('notes')
    .eq('id', sessionId)
    .single()

  const notes = session?.notes || ''
  const langLabel = lang === 'es' ? 'Spanish' : 'English'

  const prompt = `You are an English language teaching assistant. A teacher just finished an English class and provided the following class notes:

Teacher notes:
${notes || '(No notes provided — generate a general encouraging session completion summary)'}

Generate a structured post-class summary. Respond in ${langLabel} with valid JSON only — no markdown, no explanation, just the JSON object:
{
  "covered": ["first topic or skill covered", "second topic"],
  "nextTopics": ["first suggested topic for next class", "second suggestion"],
  "progressNote": "A brief, encouraging 1-2 sentence note about the student's progress"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text: string = data.content?.[0]?.text || ''
    const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    const summary: SessionSummary = JSON.parse(cleaned)

    await adminClient
      .from('sessions')
      .update({ teacher_notes: JSON.stringify(summary) })
      .eq('id', sessionId)

    return summary
  } catch {
    return null
  }
}

export async function completeSession(
  bookingId: string,
  sessionId: string | null,
  lang: string = 'es'
): Promise<{ success: boolean; summary?: SessionSummary } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, duration_minutes,
      teacher:teachers(id, profile_id, hourly_rate, total_sessions),
      student:students(id, profile_id)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found' }

  const teacherProfileId = (booking.teacher as any)?.profile_id
  if (user.id !== teacherProfileId) {
    return { error: 'Only the teacher can end the session' }
  }

  const adminClient = createAdminClient()

  let sid = sessionId
  if (!sid) {
    const { data: s } = await adminClient
      .from('sessions')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    sid = s?.id || null
  }

  if (sid) {
    const { error: sessionErr } = await adminClient
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sid)
    console.log('[completeSession] session ended_at update', { sid, error: sessionErr?.message })
  }

  const { error: bookingErr } = await adminClient
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)
  console.log('[completeSession] booking completed', { bookingId, error: bookingErr?.message })

  const teacherId = (booking.teacher as any)?.id
  const studentId = (booking.student as any)?.id

  if (teacherId) {
    const total = (booking.teacher as any)?.total_sessions || 0
    await adminClient
      .from('teachers')
      .update({ total_sessions: total + 1 })
      .eq('id', teacherId)
  }

  if (studentId && teacherId) {
    const { data: existingPayment } = await adminClient
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!existingPayment) {
      const hourlyRate = (booking.teacher as any)?.hourly_rate || 0
      const sessionRate = Math.round(hourlyRate * ((booking.duration_minutes || 50) / 60))

      await adminClient.from('payments').insert({
        booking_id: bookingId,
        student_id: studentId,
        teacher_id: teacherId,
        amount_usd: sessionRate,
        teacher_payout_usd: sessionRate,
        platform_fee_usd: 0,
        status: 'completed',
      })
    }
  }

  let summary: SessionSummary | undefined
  if (sid) {
    const result = await generateSessionSummary(sid, lang).catch(() => null)
    if (result) summary = result
  }

  revalidatePath(`/${lang}/dashboard`)
  revalidatePath(`/${lang}/dashboard/clases`)
  revalidatePath(`/${lang}/maestro/dashboard`)
  revalidatePath(`/${lang}/maestro/dashboard/clases`)

  return { success: true, ...(summary ? { summary } : {}) }
}

export async function getSessionByBookingId(bookingId: string): Promise<{
  id: string
  notes: string | null
  teacher_notes: string | null
  started_at: string | null
  ended_at: string | null
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()

  const { data: booking } = await adminClient
    .from('bookings')
    .select(`
      teacher:teachers(profile_id),
      student:students(profile_id)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return null

  const teacherProfileId = (booking.teacher as any)?.profile_id
  const studentProfileId = (booking.student as any)?.profile_id

  if (user.id !== teacherProfileId && user.id !== studentProfileId) return null

  const { data: session } = await adminClient
    .from('sessions')
    .select('id, notes, teacher_notes, started_at, ended_at')
    .eq('booking_id', bookingId)
    .maybeSingle()

  return session || null
}
