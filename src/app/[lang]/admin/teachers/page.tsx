import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeachersTableClient, { type EnrichedTeacher } from './TeachersTableClient'

interface Props { params: Promise<{ lang: string }> }

const STR = {
  en: {
    kicker: '↳ Admin · Team',
    teachers: 'Teachers',
    onThePlatform: 'on the platform',
    summary: (active: number, pending: number) => `${active} active · ${pending} pending review`,
  },
  es: {
    kicker: '↳ Admin · Equipo',
    teachers: 'Maestros',
    onThePlatform: 'en la plataforma',
    summary: (active: number, pending: number) => `${active} activos · ${pending} pendientes de revisión`,
  },
} as const

export default async function AdminTeachersPage({ params }: Props) {
  const { lang } = await params
  const t = STR[lang === 'en' ? 'en' : 'es']
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Get all teachers with profiles
  const { data: allTeachers } = await admin
    .from('teachers')
    .select(`
      id, bio, specializations, certifications, hourly_rate, rating,
      total_sessions, is_active, admin_notes, created_at,
      profile:profiles(id, full_name, email, timezone)
    `)
    .order('created_at', { ascending: false })

  // Get active student counts from confirmed bookings
  const { data: activeBookings } = await admin
    .from('bookings')
    .select('teacher_id, student_id')
    .eq('status', 'confirmed')
    .eq('type', 'class')

  // Build activeStudentCount map: teacherId -> Set of studentIds
  const studentCountMap = new Map<string, Set<string>>()
  for (const b of activeBookings || []) {
    if (b.teacher_id) {
      if (!studentCountMap.has(b.teacher_id)) studentCountMap.set(b.teacher_id, new Set())
      studentCountMap.get(b.teacher_id)!.add(b.student_id)
    }
  }

  // Build enriched teachers
  const teachers: EnrichedTeacher[] = (allTeachers || []).map(t => {
    const rawProfile = t.profile
    let profileId = ''
    let full_name: string | null = null
    let email: string | null = null

    if (Array.isArray(rawProfile)) {
      const p = (rawProfile as { id: string; full_name: string | null; email: string | null }[])[0]
      profileId = p?.id || ''
      full_name = p?.full_name || null
      email = p?.email || null
    } else if (rawProfile && typeof rawProfile === 'object') {
      const p = rawProfile as { id: string; full_name: string | null; email: string | null }
      profileId = p.id || ''
      full_name = p.full_name || null
      email = p.email || null
    }

    return {
      id: t.id,
      profile_id: profileId,
      full_name,
      email,
      bio: t.bio || null,
      specializations: t.specializations || null,
      certifications: t.certifications || null,
      hourly_rate: t.hourly_rate || null,
      rating: t.rating || null,
      total_sessions: t.total_sessions || null,
      is_active: t.is_active,
      created_at: t.created_at,
      activeStudentCount: studentCountMap.get(t.id)?.size || 0,
    }
  })

  const activeCount = teachers.filter(t => t.is_active).length
  const pendingCount = teachers.filter(t => !t.is_active).length

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div
          style={{
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ek-text-muted)',
            marginBottom: 6,
          }}
        >
          {t.kicker}
        </div>
        <h1
          style={{
            fontFamily: 'var(--ek-font-sans)',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: 'var(--ek-text)',
            lineHeight: 1.1,
          }}
        >
          {t.teachers}{' '}
          <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ek-text-muted)' }}>
            {t.onThePlatform}
          </span>
        </h1>
        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--ek-text-muted)' }}>
          {t.summary(activeCount, pendingCount)}
        </p>
      </div>

      <TeachersTableClient teachers={teachers} lang={lang} />
    </div>
  )
}
