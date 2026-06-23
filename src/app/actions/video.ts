'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { AccessToken } from 'livekit-server-sdk'
import * as Sentry from '@sentry/nextjs'
import { checkUserActionLimit } from '@/lib/rateLimit'

const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

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
  // Cap the upload — a chunk is a few seconds of webm (tens of KB). A multi-MB
  // body is misuse; reject it before spending Deepgram credit (video-6).
  if (audio.size > 2_000_000) return { error: 'too-large' }

  // Service-role read (RLS-bypassing): admins / admin-conductors aren't in the
  // bookings SELECT policies, so a user-scoped read would strand a conductor on
  // 'unauthorized'. The isParticipant/isAdmin check below is the real gate — the
  // fetch is only made visible, not authorized.
  const adminClient = createAdminClient()
  const { data: booking } = await adminClient
    .from('bookings')
    .select('id, status, conductor_profile_id, teacher:teachers(profile_id), student:students(profile_id)')
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
  // Only an active (pending/confirmed) session may spend transcription credit —
  // not a cancelled/completed booking the participant could loop over.
  if ((booking as { status?: string }).status !== 'pending' && (booking as { status?: string }).status !== 'confirmed') return { error: 'not-active' }

  // Throttle per user — stops a participant looping the endpoint to drain
  // Deepgram credit. Generous ceiling so a real 60-min class never trips it (video-6).
  // ~10 chunks/min per user (6s slices) = ~150 per rolling 15-min window; 300 is
  // 2x that headroom so a real class never trips it while a loop is capped (video-6).
  const rl = await checkUserActionLimit(user.id, 'transcribe', 300, 15, true)
  if (!rl.ok) return { error: 'rate-limited' }

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

// Stable, locale-independent error codes returned by getRoomAccess. The client
// (ErrorScreen) maps these to localized prose via the sala i18n dictionary so the
// Spanish UI never shows hardcoded English. Do NOT return prose from here.
export type RoomAccessError =
  | 'not-authenticated'
  | 'not-found'
  | 'not-authorized'
  | 'cancelled'
  | 'completed'
  | 'invalid-time'
  | 'expired'
  | 'init-failed'
  | 'token-failed'

export async function getRoomAccess(bookingId: string): Promise<
  { url: string; token: string; sessionId: string; isDevMode: boolean } | { error: RoomAccessError }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not-authenticated' }

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

  if (!booking) return { error: 'not-found' }

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
    return { error: 'not-authorized' }
  }

  if (booking.status === 'cancelled') {
    return { error: 'cancelled' }
  }

  // A completed booking's room must not re-open — completeSession is terminal
  // (it pays the teacher + writes the summary). The client shows EndedScreen, but
  // a direct action call would otherwise mint a fresh token for a finished class.
  if (booking.status === 'completed') {
    return { error: 'completed' }
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.LIVEKIT_URL
  const isDevMode = !apiKey || !apiSecret || !wsUrl
  // P0-2: in PRODUCTION, missing LiveKit keys must NOT silently open a degraded,
  // window-less dev-mode room — that hands a real student/teacher a broken class.
  // Fail closed (client shows the error screen) + alert loudly so a key-loss
  // deploy is caught immediately rather than discovered by a confused user.
  if (isDevMode && IS_PROD) {
    Sentry.captureMessage('getRoomAccess: LIVEKIT_API_KEY/SECRET/URL missing in production — classroom disabled', 'fatal')
    console.error('[getRoomAccess] LIVEKIT keys missing in PRODUCTION — refusing to open a window-less room. Set LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL.')
    return { error: 'init-failed' }
  }

  // Timing window — Zoom-style lobby. Participants may enter at any time;
  // the client renders a countdown lobby if `now < scheduled_at`. We only
  // gate the LATE cap here (session expires 90 min after the scheduled end).
  if (!isDevMode) {
    const now = Date.now()
    const scheduled = new Date(booking.scheduled_at).getTime()
    // Guard a malformed scheduled_at — NaN arithmetic would make closeAt NaN and
    // `now > NaN` false, leaving the room joinable forever.
    if (isNaN(scheduled)) {
      return { error: 'invalid-time' }
    }
    const durationMs = (booking.duration_minutes ?? 60) * 60 * 1000
    const closeAt = scheduled + durationMs + 90 * 60 * 1000
    if (now > closeAt) {
      return { error: 'expired' }
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

    if (newSession?.id) {
      sessionId = newSession.id
    } else {
      // P0-3: teacher + student opening /sala the same instant both read null
      // above and race to insert. The sessions(booking_id) unique index (migration
      // 050) makes the loser's insert fail (23505) — re-select so BOTH joiners
      // converge on the ONE canonical session row. Without this, duplicate rows
      // broke "Terminar Clase" (.maybeSingle errors) and could read the row
      // missing student_joined_at, silently withholding a real teacher payout.
      const { data: raced } = await adminClient
        .from('sessions')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle()
      if (raced?.id) {
        sessionId = raced.id
      } else {
        if (sessionError) Sentry.captureException(sessionError, { tags: { area: 'getRoomAccess' }, extra: { bookingId } })
        return { error: 'init-failed' }
      }
    }
  }

  // Attendance signal: stamp the first time the STUDENT opens the room. This is
  // what gates the teacher payout in completeSession — a no-show (student never
  // reached the room) leaves this null, so the teacher isn't paid for a class
  // that didn't happen. Set-once (only when null) so the timestamp is the real
  // first join; fire-and-forget so it never blocks room entry.
  if (user.id === studentProfileId) {
    // P2-6: only count attendance once the class is effectively LIVE (≤10 min before
    // start onward). The join link / lobby is reachable up to 24h early, so stamping
    // on ANY entry let a far-early click mark a later NO-SHOW as "attended" — which
    // would pay the teacher for a class the student skipped (defeating migration 045).
    const scheduledMs = new Date(booking.scheduled_at).getTime()
    const ATTEND_GRACE_MS = 10 * 60 * 1000
    if (!isNaN(scheduledMs) && Date.now() >= scheduledMs - ATTEND_GRACE_MS) {
      await adminClient
        .from('sessions')
        .update({ student_joined_at: new Date().toISOString() })
        .eq('id', sessionId)
        .is('student_joined_at', null)
        .then(() => undefined, () => undefined)
    }
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
    return { error: 'token-failed' }
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
      booking:bookings(status, teacher:teachers(profile_id))
    `)
    .eq('id', sessionId)
    .single()

  const teacherProfileId = (sessionRow?.booking as any)?.teacher?.profile_id
  if (!teacherProfileId || teacherProfileId !== user.id) return { success: false }
  // Don't allow writes once the booking is terminal — the session is paid-out,
  // notes/transcript shouldn't change after the fact (server-action-authz).
  const bStatus = (sessionRow?.booking as any)?.status
  if (bStatus && bStatus !== 'pending' && bStatus !== 'confirmed') return { success: false }

  const { error } = await adminClient
    .from('sessions')
    // Server-side length cap (defense-in-depth) — the client textarea isn't the
    // authority. A 60-min class of notes is well under 100k chars.
    .update({ notes: (notes || '').slice(0, 100_000) })
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
    const parsed = JSON.parse(cleaned) as unknown

    // Don't trust the model's shape (CALL-06). Valid JSON with the wrong shape
    // (e.g. `covered` as a string) would otherwise persist and crash the client
    // when it maps over it. Coerce to the SessionSummary contract: arrays of
    // strings (bounded) + a string note.
    const toStringList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
    const obj = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {}
    const summary: SessionSummary = {
      covered: toStringList(obj.covered),
      nextTopics: toStringList(obj.nextTopics),
      progressNote: typeof obj.progressNote === 'string' ? obj.progressNote.slice(0, 1000) : '',
    }

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
  // Error strings are surfaced verbatim in the room's endError toast
  // (RoomShell), so they must follow the UI locale — never raw English in an
  // /es room (mirrors the lang-gated integrity gate below).
  if (!user) return { error: lang === 'es' ? 'No has iniciado sesión.' : 'Not authenticated' }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes,
      teacher:teachers(id, profile_id, hourly_rate, total_sessions),
      student:students(id, profile_id)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: lang === 'es' ? 'No se encontró la reserva.' : 'Booking not found' }

  const teacherProfileId = (booking.teacher as any)?.profile_id
  if (user.id !== teacherProfileId) {
    return { error: lang === 'es' ? 'Solo el maestro puede finalizar la sesión.' : 'Only the teacher can end the session' }
  }

  // Block completing a CANCELLED session — that would mint a teacher payout +
  // session count for a class that didn't happen. pending and confirmed both
  // proceed (a class can go live before a formal confirm, and dev-mode bookings
  // stay 'pending'); an already-completed booking is idempotent via justCompleted.
  if (booking.status === 'cancelled') {
    return { error: lang === 'es' ? 'Esta sesión fue cancelada.' : 'This session was cancelled.' }
  }

  // Integrity gate: a class cannot be "completed" before it has actually started.
  // Without this, a teacher could open ANY upcoming booking, click "End class",
  // and mint themselves a payout + a session-count bump for a class that never
  // happened (the only prior gates were auth + not-cancelled). Block completing a
  // booking whose scheduled start is still in the future.
  const scheduledMs = new Date((booking as { scheduled_at: string }).scheduled_at).getTime()
  if (!Number.isNaN(scheduledMs) && Date.now() < scheduledMs) {
    return {
      error: lang === 'es'
        ? 'No puedes finalizar una clase que aún no ha comenzado.'
        : "You can't end a class that hasn't started yet.",
    }
  }

  const adminClient = createAdminClient()

  // Resolve the session AUTHORITATIVELY from the bookingId — never trust the
  // client-passed sessionId for writes (a tampered id could point at another
  // booking's session). One read yields both the id and the attendance flag.
  const { data: sessionRow } = await adminClient
    .from('sessions')
    .select('id, student_joined_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  const sid = sessionRow?.id || null

  if (sid) {
    const { error: sessionErr } = await adminClient
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sid)
    if (sessionErr) console.error('[completeSession] session ended_at update failed:', sessionErr.message)
  }

  // Attendance gate (migration 045): the teacher is paid only for a class the
  // STUDENT actually opened (getRoomAccess stamps sessions.student_joined_at on
  // the student's first room entry). A no-show — student never reached the room —
  // still completes the booking but mints NO payout + NO session-count, closing
  // the "instant-end-at-start pays for a no-show" hole. No session row at all
  // (neither party opened the room) is likewise treated as no-attendance.
  const studentJoined = !!sessionRow?.student_joined_at

  // Status-gated flip confirmed→completed. The call that actually flips the row
  // (justCompleted) is the only one that runs the one-time side effects below —
  // race-safe and idempotent on re-calls.
  const { data: completedRows, error: bookingErr } = await adminClient
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (bookingErr) console.error('[completeSession] booking complete failed:', bookingErr.message)
  const justCompleted = !!(completedRows && completedRows.length > 0)
  // Success-path signal at the meaningful granularity (the status flip that
  // triggers payout + summary), so completions stay observable in logs.
  if (justCompleted) console.info('[completeSession] booking completed', { bookingId })

  const teacherId = (booking.teacher as any)?.id
  const studentId = (booking.student as any)?.id

  // Attendance-gated payout: a no-show (studentJoined === false) completes the
  // booking but mints neither a session-count nor a payment. The teacher is paid
  // only for a class the student actually showed up to.
  if (justCompleted && !studentJoined) {
    console.info('[completeSession] no student attendance — payout + session-count withheld', { bookingId, teacherId })
  }

  if (teacherId && justCompleted && studentJoined) {
    // Atomic increment (migration 046): a read-modify-write here could lose an
    // increment when two DIFFERENT bookings for the same teacher complete at once.
    const { error: incErr } = await adminClient.rpc('increment_teacher_sessions', { p_teacher_id: teacherId })
    if (incErr) console.error('[completeSession] total_sessions increment failed:', incErr.message)
  }

  if (studentId && teacherId && studentJoined) {
    const { data: existingPayment } = await adminClient
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!existingPayment) {
      const hourlyRate = (booking.teacher as any)?.hourly_rate || 0
      // A teacher with no hourly_rate would silently get a $0 payout — flag the
      // misconfiguration server-side so it's visible in the logs (TEACH-LOW-4).
      if (!hourlyRate) {
        console.error('[completeSession] teacher has no hourly_rate; payout will be $0', { teacherId })
      }
      // Canonical class length is 60 min (one credit = one 60-min class). Fall
      // back to 60 (not 50) when duration_minutes is missing so a null duration
      // never under-prices the teacher's payout.
      const sessionRate = Math.round(hourlyRate * ((booking.duration_minutes || 60) / 60))

      const { error: payErr } = await adminClient.from('payments').insert({
        booking_id: bookingId,
        student_id: studentId,
        teacher_id: teacherId,
        amount_usd: sessionRate,
        teacher_payout_usd: sessionRate,
        platform_fee_usd: 0,
        status: 'completed',
      })
      // 23505 = unique(payments.booking_id) (migration 034): a concurrent flip
      // already paid out — safe to ignore so we don't double-pay the teacher.
      if (payErr && payErr.code !== '23505') {
        console.error('[completeSession] payment insert error:', payErr.message)
      }
    }
  }

  let summary: SessionSummary | undefined
  if (sid && justCompleted) {
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
// the teacher's browser right after completeSession() (which flips the booking
// to 'completed'), so the summary modal and the student's class-history
// transcript panel both have it. Only the booking's teacher may write, and only
// once — see the first-write-only guard below.
export async function saveSessionTranscript(
  bookingId: string,
  transcript: string,
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  // Server-side length cap (defense-in-depth) — a full class transcript is well
  // under 500k chars; the client isn't the authority on size.
  const trimmed = transcript.trim().slice(0, 500_000)
  if (!trimmed) return { success: false }

  const adminClient = createAdminClient()

  // Resolve the session AUTHORITATIVELY from the bookingId — never trust a
  // client-passed sessionId for writes (mirrors completeSession).
  const { data: sessionRow } = await adminClient
    .from('sessions')
    .select(`
      id,
      booking:bookings(status, teacher:teachers(profile_id))
    `)
    .eq('booking_id', bookingId)
    .maybeSingle()

  const teacherProfileId = (sessionRow?.booking as any)?.teacher?.profile_id
  if (!sessionRow || !teacherProfileId || teacherProfileId !== user.id) return { success: false }
  // This save runs RIGHT AFTER completeSession flips the booking to 'completed',
  // so 'completed' must be allowed — but only as a one-time back-fill: the
  // .is('transcript', null) below makes the write first-write-only, so a
  // paid-out session's transcript can't be rewritten after the fact. A cancelled
  // (or otherwise non-class) booking is rejected outright.
  const bStatus = (sessionRow.booking as any)?.status
  if (!['pending', 'confirmed', 'completed'].includes(bStatus)) return { success: false }

  const { error } = await adminClient
    .from('sessions')
    .update({
      transcript: trimmed,
      transcript_captured_at: new Date().toISOString(),
    })
    .eq('id', sessionRow.id)
    .is('transcript', null)

  return { success: !error }
}

// Coerce an untrusted vocab payload to the CuadernoVocabItem contract: drop
// non-objects / wrong-typed entries, bound each field's length, require a
// non-empty word AND translation (a blank translation would render as an empty
// row), and cap the count (defense-in-depth; a 60-min class yields well under
// 200 words). Shared by the writer (saveSessionVocab) and the reader
// (getSessionByBookingId) so the stored and returned shapes can never drift.
function cleanVocab(vocab: unknown): CuadernoVocabItem[] {
  return (Array.isArray(vocab) ? vocab : [])
    .filter((x): x is CuadernoVocabItem =>
      !!x && typeof x.word === 'string' && typeof x.translation === 'string' && typeof x.example === 'string'
    )
    .map((x) => ({
      word: x.word.slice(0, 120),
      translation: x.translation.slice(0, 200),
      example: x.example.slice(0, 500),
    }))
    .filter((x) => x.word.trim().length > 0 && x.translation.trim().length > 0)
    .slice(0, 200)
}

// Persist the AI cuaderno vocabulary captured during the class (CuadernoVocabItem[]
// from extractLiveVocab, accumulated in useLiveVocab). Called from the teacher's
// browser right after completeSession — same pattern + same guards as
// saveSessionTranscript — so the student can review the new words afterward in
// their class history. Best-effort: never blocks ending the class.
export async function saveSessionVocab(
  bookingId: string,
  vocab: CuadernoVocabItem[],
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const cleaned = cleanVocab(vocab)
  if (cleaned.length === 0) return { success: false }

  const adminClient = createAdminClient()

  // Resolve the session AUTHORITATIVELY from the bookingId — never trust a
  // client-passed sessionId for writes (mirrors completeSession).
  const { data: sessionRow } = await adminClient
    .from('sessions')
    .select(`
      id,
      booking:bookings(status, teacher:teachers(profile_id))
    `)
    .eq('booking_id', bookingId)
    .maybeSingle()

  const teacherProfileId = (sessionRow?.booking as any)?.teacher?.profile_id
  if (!sessionRow || !teacherProfileId || teacherProfileId !== user.id) return { success: false }
  // 'completed' is the normal save path (completeSession flips status before this
  // runs); the .is('vocabulary', null) below keeps it first-write-only so a
  // paid-out session's words can't be rewritten after the fact. Reject cancelled
  // / non-class bookings outright.
  const bStatus = (sessionRow.booking as any)?.status
  if (!['pending', 'confirmed', 'completed'].includes(bStatus)) return { success: false }

  const { error } = await adminClient
    .from('sessions')
    .update({
      vocabulary: cleaned,
      vocabulary_captured_at: new Date().toISOString(),
    })
    .eq('id', sessionRow.id)
    .is('vocabulary', null)

  return { success: !error }
}

export async function getSessionByBookingId(bookingId: string): Promise<{
  id: string
  notes: string | null
  teacher_notes: string | null
  transcript: string | null
  transcript_captured_at: string | null
  vocabulary: CuadernoVocabItem[] | null
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
      conductor_profile_id,
      teacher:teachers(profile_id),
      student:students(profile_id)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return null

  const teacherProfileId = (booking.teacher as any)?.profile_id
  const studentProfileId = (booking.student as any)?.profile_id
  const conductorProfileId = (booking as any).conductor_profile_id

  // Readers = the booking's teacher / student / placement conductor, OR any admin
  // (support + placement review). A conductor who ran the call could not read its
  // notes/transcript afterward before this — mirrors getRoomAccess's participant set.
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAllowed =
    user.id === teacherProfileId ||
    user.id === studentProfileId ||
    user.id === conductorProfileId ||
    caller?.role === 'admin'
  if (!isAllowed) return null

  const { data: session } = await adminClient
    .from('sessions')
    .select('id, notes, teacher_notes, transcript, transcript_captured_at, vocabulary, started_at, ended_at')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (!session) return null
  // vocabulary is jsonb (returns as Json) — run it through the same validator the
  // writer uses so the read contract enforces the stored shape (null if empty).
  const cleanedVocab = cleanVocab((session as { vocabulary?: unknown }).vocabulary)
  const vocabulary = cleanedVocab.length > 0 ? cleanedVocab : null
  return { ...session, vocabulary }
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
    .select('id, status, conductor_profile_id, teacher:teachers(profile_id), student:students(profile_id)')
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
  // Only an active session may spend AI credit — not a cancelled/completed booking.
  if ((booking as { status?: string }).status !== 'pending' && (booking as { status?: string }).status !== 'confirmed') return []

  // Throttle per user — caps runaway loops draining Anthropic credit. Fires every
  // ~30s in a real class (~2/min = ~30 per rolling 15-min window), so 60 is 2x
  // headroom — a real class never trips it (video-6).
  const rl = await checkUserActionLimit(user.id, 'extractVocab', 60, 15, true)
  if (!rl.ok) return []

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
