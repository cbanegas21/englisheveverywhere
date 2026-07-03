import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EstudiantesClient from './EstudiantesClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function EstudiantesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacherData) redirect(`/${lang}/onboarding`)

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      student_id,
      scheduled_at,
      status,
      student:students(
        level,
        learning_goal,
        work_description,
        learning_style,
        age_range,
        profile:profiles(full_name, avatar_url)
      )
    `)
    .eq('teacher_id', teacherData.id)
    .order('scheduled_at', { ascending: false })

  // The student→profile embed is NULL under RLS (a teacher has no SELECT policy
  // on student profiles rows), so names/avatars showed as "Student" (deep-audit
  // I18N-6). Resolve them via the service-role client — ownership is already
  // scoped by .eq('teacher_id') above.
  const studentIds = Array.from(new Set((bookings ?? []).map((b) => b.student_id).filter((x): x is string => !!x)))
  if (studentIds.length) {
    const admin = createAdminClient()
    const { data: profRows } = await admin
      .from('students')
      .select('id, profile:profiles(full_name, avatar_url)')
      .in('id', studentIds)
    const profById = new Map<string, { full_name: string | null; avatar_url: string | null }>()
    for (const s of profRows ?? []) {
      const rawProf = (s as unknown as { profile?: unknown }).profile
      const p = (Array.isArray(rawProf) ? rawProf[0] : rawProf) as { full_name: string | null; avatar_url: string | null } | null
      profById.set(s.id as string, { full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null })
    }
    for (const b of bookings ?? []) {
      const st = (b as { student?: { profile?: unknown } }).student
      if (st) st.profile = profById.get((b as { student_id: string }).student_id) ?? { full_name: null, avatar_url: null }
    }
  }

  return (
    <EstudiantesClient
      lang={lang as Locale}
      bookings={(bookings as any) || []}
    />
  )
}
