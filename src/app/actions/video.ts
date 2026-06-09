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

// Transcribe one short audio chunk (recorded from the caller's own mic in the
// browser) via Deepgram nova-3 multilingual. The Deepgram key stays server-side
// — the browser only uploads audio, never sees the key. Participant/admin
// guarded so only people in the call can spend transcription credit. Returns
// `{ error: 'not-configured' }` when no key is set so the client can fall back.
export async function transcribeAudioChunk(
  formData: FormData,
): Promise<{ text: string } | { error: string }> {
  const masterKey = process.env.DEEPGRAM_API_KEY
  if (!masterKey || masterKey === 'dg_placeholder') return { error: 'not-configured' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const bookingId = formData.get('bookingId') as string | null
  const audio = formData.get('audio')
  if (!bookingId || !(audio instanceof File)) return { error: 'bad-request' }

  // Service-role read (RLS-bypassing): admins / admin-conductors aren't in the
  // bookings SELECT policies, so a user-scoped read would strand a conductor on
  // 'unauthorized'. The isParticipant/isAdmin check below is the real gate — the
  // fetch is only made visible, not authorized.
  const adminClient = createAdminClient()
  const { data: booking } = await adminClient
    .from('bookings')
    .select('id, conductor_profile_id, teacher:teachers(profile_id), student:students(profile_id)')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'unauthorized' }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = caller?.role === 'admin'
  const isParticipant =
    user.id === (booking.teacher as any)?.profile_id ||
    user.id === (booking.student as any)?.profile_id ||
    user.id === (booking as any).conductor_profile_id
  if (!isParticipant && !isAdmin) return { error: 'unauthorized' }

  try {
    const buf = Buffer.from(await audio.arrayBuffer())
    if (buf.byteLength < 1200) return { text: '' } // too small to hold speech
    const params = new URLSearchParams({
      model: 'nova-3', language: 'multi', smart_format: 'true', punctuate: 'true',
    })
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Token ${masterKey}`, 'Content-Type': audio.type || 'audio/webm' },
      body: buf,
    })
    if (!res.ok) return { error: 'deepgram-error' }
    const data = await res.json()
    const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || ''
    return { text }
  } catch {
    return { error: 'deepgram-error' }
  }
}

export async function getRoomAccess(bookingId: string): Promise<
  { url: string; token: string; sessionId: string; isDevMode: boolean } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Service-role read (RLS-bypassing): admins / admin-conductors aren't in the
  // bookings SELECT policies, so a user-scoped read returns null and strands
  // them on 'Booking not found' before the authorization branch. Access is
  // gated explicitly by the isParticipant/isAdmin check below, not by RLS.
  const adminClient = createAdminClient()
  const { data: booking } = await adminClient
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
  // Non-participant admins receive an observer-only grant (canPublish:false) at
  // the token-mint step below; conductors are participants and keep full publish.
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

  // A completed booking's room must not re-open — completeSession is terminal
  // (it pays the teacher + writes the summary). The client shows EndedScreen, but
  // a direct action call would otherwise mint a fresh token for a finished class.
  if (booking.status === 'completed') {
    return { error: 'This session has already ended.' }
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

  // Create or get session record (reusing the admin client from the fetch above)
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

    // Non-participant admins join as observers (support / observation): they can
    // watch and use the data channel, but cannot publish A/V into the class.
    // Conductors are participants (conductor_profile_id) → full publish, since
    // they actively run placement calls.
    const isObserver = isAdmin && !isParticipant
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !isObserver,
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

  // Ownership check: only the teacher on this session's booking can write
  // notes. Without this, any authenticated user could overwrite any
  // session's notes by passing a session id (adminClient bypasses RLS).
  const { data: sessionRow } = await adminClient
    .from('sessions')
    .select(`
      id,
      booking:bookings(teacher:teachers(profile_id))
    `)
    .eq('id', sessionId)
    .single()

  const teacherProfileId = (sessionRow?.booking as any)?.teacher?.profile_id
  if (!teacherProfileId || teacherProfileId !== user.id) return { success: false }

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

  // Idempotency guard — a second click (or retry) must not double-increment
  // teachers.total_sessions or re-run summary generation.
  const alreadyCompleted = booking.status === 'completed'

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

  if (teacherId && !alreadyCompleted) {
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
  if (sid && !alreadyCompleted) {
    const result = await generateSessionSummary(sid, lang).catch(() => null)
    if (result) summary = result
  }

  revalidatePath(`/${lang}/dashboard`)
  revalidatePath(`/${lang}/dashboard/clases`)
  revalidatePath(`/${lang}/maestro/dashboard`)
  revalidatePath(`/${lang}/maestro/dashboard/clases`)
  revalidatePath(`/${lang}/maestro/dashboard/ganancias`)
  revalidatePath(`/${lang}/admin/bookings`)

  return { success: true, ...(summary ? { summary } : {}) }
}

// Persist the live-transcript text captured from the classroom. Called from
// the teacher's browser immediately before completeSession() so the summary
// modal and the student's class-history transcript panel both have it.
// Only the booking's teacher may write.
export async function saveSessionTranscript(
  sessionId: string,
  transcript: string,
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const trimmed = transcript.trim()
  if (!trimmed) return { success: false }

  const adminClient = createAdminClient()

  const { data: sessionRow } = await adminClient
    .from('sessions')
    .select(`
      id,
      booking:bookings(teacher:teachers(profile_id))
    `)
    .eq('id', sessionId)
    .single()

  const teacherProfileId = (sessionRow?.booking as any)?.teacher?.profile_id
  if (!teacherProfileId || teacherProfileId !== user.id) return { success: false }

  const { error } = await adminClient
    .from('sessions')
    .update({
      transcript: trimmed,
      transcript_captured_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  return { success: !error }
}

export async function getSessionByBookingId(bookingId: string): Promise<{
  id: string
  notes: string | null
  teacher_notes: string | null
  transcript: string | null
  transcript_captured_at: string | null
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
    .select('id, notes, teacher_notes, transcript, transcript_captured_at, started_at, ended_at')
    .eq('booking_id', bookingId)
    .maybeSingle()

  return session || null
}

// ─── Live AI cuaderno ──────────────────────────────────────────────────────
// Called every ~30 seconds from useLiveVocab during an active class. Sends
// the recent transcript chunk to Claude haiku 4.5 and asks for any
// teaching-worthy vocabulary the student probably doesn't know yet.
// Result is rendered live in the cuaderno sidebar.
//
// Cost note: with ~200-500 tokens per chunk and a 60-min class running 120
// chunks max, this is ~$0.05-0.10 per class on claude-haiku-4-5. Budget
// guard: returns [] if ANTHROPIC_API_KEY is missing (graceful degrade) and
// if `text` is too short to bother extracting from.

export interface CuadernoVocabItem {
  word: string
  translation: string
  example: string
}

export async function extractLiveVocab(
  bookingId: string,
  text: string,
  options: { lang?: 'es' | 'en'; alreadyKnown?: string[] } = {}
): Promise<CuadernoVocabItem[]> {
  const trimmed = text.trim()
  if (trimmed.length < 60) return []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  // Participant/admin gate. Without this the action is an unauthenticated proxy
  // to Anthropic on the server key (audit: cost-abuse). Mirrors the guard on
  // transcribeAudioChunk. Returns [] on any failure to preserve the hook's
  // graceful-degrade contract (no Anthropic call is reached before this passes).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  if (!bookingId) return []
  // Service-role read (RLS-bypassing) so admins / admin-conductors resolve on a
  // placement call; the isParticipant/isAdmin gate below is the real authorization.
  const adminClient = createAdminClient()
  const { data: booking } = await adminClient
    .from('bookings')
    .select('id, conductor_profile_id, teacher:teachers(profile_id), student:students(profile_id)')
    .eq('id', bookingId)
    .single()
  if (!booking) return []

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = caller?.role === 'admin'
  const isParticipant =
    user.id === (booking.teacher as any)?.profile_id ||
    user.id === (booking.student as any)?.profile_id ||
    user.id === (booking as any).conductor_profile_id
  if (!isParticipant && !isAdmin) return []

  const lang = options.lang || 'es'
  const known = (options.alreadyKnown || []).slice(0, 60).join(', ')
  const langLabel = lang === 'es' ? 'Spanish' : 'English'

  const prompt = `You are an English-teaching assistant. Below is a 30-second chunk of a live English-class conversation (the speakers may mix Spanish and English).

Extract AT MOST 2 vocabulary items the Spanish-speaking learner probably does NOT know yet — single English words OR short phrasal verbs / idioms. Skip basic words (greetings, "yes", "no", "good", "thank you"). Skip anything already in the "alreadyKnown" list.

Reply with ${langLabel} translation and a short English example sentence taken from or inspired by the chunk.

Respond with valid JSON only — no markdown:
[
  { "word": "<english>", "translation": "<${langLabel}>", "example": "<short english sentence>" }
]

If nothing teaching-worthy in the chunk, respond with [].

Chunk:
${trimmed.slice(0, 1800)}

Already known:
${known || '(none yet)'}`

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
        max_tokens: 320,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) return []
    const data = await response.json()
    const raw: string = data.content?.[0]?.text || '[]'
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is CuadernoVocabItem =>
        !!x && typeof x.word === 'string' && typeof x.translation === 'string' && typeof x.example === 'string'
      )
      .slice(0, 2)
  } catch {
    return []
  }
}
