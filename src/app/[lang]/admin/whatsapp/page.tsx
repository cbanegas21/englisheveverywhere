import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Locale } from '@/lib/i18n/translations'
import RemindersClient, { type ReminderRow } from './RemindersClient'

interface Props { params: Promise<{ lang: string }> }

// How far ahead we surface upcoming classes for manual WhatsApp reminders.
const WINDOW_DAYS = 7

// Supabase embeds come back as an object or a 1-element array depending on the
// relationship shape — normalize to a single record.
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type ProfileEmbed = {
  full_name: string | null
  phone: string | null
  preferred_language: string | null
  notification_preferences: unknown
}

export default async function AdminWhatsappRemindersPage({ params }: Props) {
  const { lang } = await params
  const locale = (lang === 'en' ? 'en' : 'es') as Locale

  // The /admin layout already enforces role === 'admin'; keep the auth check for
  // the page to stand on its own.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Upcoming confirmed student-facing sessions in the window. Phone +
  // notification_preferences are only readable via the service-role client
  // (migration 033 column-revoked them from authenticated).
  const { data: rows } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, type, status,
      student:students(profile:profiles(full_name, phone, preferred_language, notification_preferences)),
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('status', 'confirmed')
    .in('type', ['class', 'placement_test'])
    .gte('scheduled_at', now.toISOString())
    .lt('scheduled_at', windowEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  const reminders: ReminderRow[] = []
  for (const b of rows || []) {
    // Both the booking→student/teacher embeds AND the nested →profile embed can
    // come back as a single object or a 1-element array — unwrap BOTH levels.
    const studentObj = unwrap(b.student as { profile?: ProfileEmbed | ProfileEmbed[] } | { profile?: ProfileEmbed | ProfileEmbed[] }[] | null)
    const sProfile = unwrap(studentObj?.profile) as ProfileEmbed | null
    const prefs = (sProfile?.notification_preferences ?? null) as
      | { whatsapp?: boolean; before24h?: boolean; before1h?: boolean }
      | null
    // Only students who opted into WhatsApp reminders.
    if (!prefs?.whatsapp) continue
    const teacherObj = unwrap(b.teacher as { profile?: { full_name: string | null } | { full_name: string | null }[] } | { profile?: { full_name: string | null } | { full_name: string | null }[] }[] | null)
    const tProfile = unwrap(teacherObj?.profile) as { full_name: string | null } | null
    reminders.push({
      bookingId: b.id as string,
      scheduledAt: b.scheduled_at as string,
      type: (b.type as string) || 'class',
      studentName: sProfile?.full_name || null,
      phone: sProfile?.phone || null,
      studentLang: sProfile?.preferred_language === 'en' ? 'en' : 'es',
      // Default the windows to ON when unset (matches the toggle's defaults).
      wants24h: prefs.before24h !== false,
      wants1h: prefs.before1h !== false,
      teacherName: tProfile?.full_name || null,
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://englishkolab.com'

  return (
    <RemindersClient
      lang={locale}
      reminders={reminders}
      windowDays={WINDOW_DAYS}
      appUrl={appUrl}
      nowIso={now.toISOString()}
    />
  )
}
