import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LabFeedClient from './LabFeedClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// The Lab — STEP 0 shell (zero schema). Re-skins EXISTING data (open assignments,
// the AI cuaderno vocabulary persisted by migration 053, completed-class count)
// into the §8.2 feed so the surface ships before any new tables land. Strictly
// credit-neutral: it only READS, never touches credits/Stripe/payouts/sessions.
export default async function LabPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .maybeSingle()
  // No students row = onboarding unfinished — mirror the dashboard home guard
  // instead of rendering an all-empty feed (SH-COLD-01).
  if (!student) redirect(`/${lang}/onboarding`)
  const studentId = student.id

  // Booking ids for the latest-vocab read. A robust two-step (vs a filtered
  // embed) so the "De tu última clase" card never silently misses.
  const { data: bookingRows } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', studentId)
  const bookingIds = (bookingRows || []).map((b: { id: string }) => b.id)

  const [{ data: assignments }, { count: completedCount }] = await Promise.all([
    admin
      .from('assignments')
      .select('id, title, status, created_at, teacher:teachers(profile:profiles(full_name))')
      .eq('student_id', studentId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(4),
    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed'),
  ])

  // Latest completed session that captured vocabulary (the cuaderno we now persist).
  let rawVocab: unknown = null
  if (bookingIds.length) {
    const { data: lastSession } = await admin
      .from('sessions')
      .select('vocabulary, ended_at')
      .in('booking_id', bookingIds)
      .not('vocabulary', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    rawVocab = (lastSession as { vocabulary?: unknown } | null)?.vocabulary ?? null
  }

  const lastClassVocab = Array.isArray(rawVocab)
    ? (rawVocab as Array<{ word?: unknown; translation?: unknown; example?: unknown }>)
        .filter((v) => v && typeof v.word === 'string' && typeof v.translation === 'string')
        .map((v) => ({
          word: String(v.word),
          translation: String(v.translation),
          example: typeof v.example === 'string' ? v.example : '',
        }))
        .slice(0, 8)
    : []

  // The teacher→profile embed comes back as nested arrays from PostgREST; normalize
  // either shape (mirrors the dashboard home's conductor/teacher name handling).
  const openAssignments = ((assignments as unknown[]) || []).map((row) => {
    const a = row as { id: string; title: string; teacher?: unknown }
    const teacher = Array.isArray(a.teacher) ? a.teacher[0] : a.teacher
    const profileRaw = (teacher as { profile?: unknown } | null)?.profile
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    const fullName = (profile as { full_name?: string | null } | null)?.full_name
    return {
      id: a.id,
      title: a.title,
      teacher_name: fullName || (lang === 'es' ? 'Maestro' : 'Teacher'),
    }
  })

  const name =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    (lang === 'es' ? 'Estudiante' : 'Student')

  return (
    <LabFeedClient
      lang={lang as Locale}
      userName={name}
      openAssignments={openAssignments}
      lastClassVocab={lastClassVocab}
      stats={{
        completedClasses: completedCount || 0,
        classesRemaining: student.classes_remaining || 0,
        lastClassWords: lastClassVocab.length,
      }}
    />
  )
}
